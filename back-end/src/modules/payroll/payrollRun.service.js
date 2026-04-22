const { getPayrollPgPool } = require("../../config/payrollDb");
const logger = require("../../logger/logger");
const { observePayrollCompute } = require("../../observability/payrollMetrics");
const { safeRollback } = require("./payrollTx");
const { getTenantIdForOrganization } = require("./payrollProvisioning.service");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const monthEndDate = (month) => {
  const [year, monthNum] = String(month).split("-").map(Number);
  return new Date(Date.UTC(year, monthNum, 0));
};

const roundAmount = (value, policy = "nearest_rupee") => {
  const v = toNumber(value, 0);
  if (policy === "floor_rupee") return Math.floor(v);
  if (policy === "exact") return Number(v.toFixed(2));
  return Math.round(v);
};

const toVarKey = (code) => String(code || "").replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();

const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

const computeSalaryContextFromRules = ({ salary }) => {
  const annualCtc = toNumber(salary.annual_ctc, 0);
  const monthlyCtc = annualCtc / 12;
  const salaryMeta = parseJson(salary.metadata, {});
  const rules = parseJson(salaryMeta.salaryRules, {});

  const hasRuleOverride = Object.keys(rules).length > 0;
  if (!hasRuleOverride) {
    const monthlyGross =
      toNumber(salary.monthly_gross, 0) || monthlyCtc;
    const basicPay = toNumber(salary.basic_pay, 0) || monthlyGross * 0.4;
    const variablePay = toNumber(salary.variable_pay, 0);
    return {
      monthlyCtc,
      monthlyGross,
      basicPay,
      variablePay,
      employerEpf: 0,
      esiAmount: 0,
      effectiveBasicPercent: basicPay > 0 && monthlyCtc > 0 ? (basicPay / monthlyCtc) * 100 : 0,
      hraPercentOfBasic: 0
    };
  }

  const payGroupBasicPercent = toNumber(rules.payGroupBasicPercent, 50);
  const basicPercentSource = String(rules.basicPercentSource || "pay_group");
  const employeeBasicPercent = toNumber(rules.employeeBasicPercent, payGroupBasicPercent);
  const effectiveBasicPercent =
    basicPercentSource === "employee" ? employeeBasicPercent : payGroupBasicPercent;
  const hraPercentOfBasic = toNumber(rules.hraPercentOfBasic, 50);

  const computedBasic = monthlyCtc * (effectiveBasicPercent / 100);
  const basicPay = toNumber(salary.basic_pay, 0) || computedBasic;
  const epfMode = String(rules.epfMode || "percentage");
  const epfPercentOfBasic = toNumber(rules.epfPercentOfBasic, 12);
  const epfFixedAmount = toNumber(rules.epfFixedAmount, 0);
  const restrictPfWage = rules.restrictPfWage !== false;
  const pfWageCeiling = toNumber(rules.pfWageCeiling, 15000);
  const epfBase = restrictPfWage ? Math.min(basicPay, pfWageCeiling) : basicPay;
  const employerEpf =
    epfMode === "fixed" ? epfFixedAmount : (epfBase * epfPercentOfBasic) / 100;
  const includeEsi = rules.includeEsi === true;
  const esiAmount = includeEsi ? Math.min((basicPay * 8.33) / 100, 1250) : 0;

  const monthlyGrossConfigured = toNumber(salary.monthly_gross, 0);
  const monthlyGrossAuto = monthlyCtc - employerEpf - esiAmount;
  const monthlyGross = monthlyGrossConfigured || monthlyGrossAuto;
  const hraAmount = (basicPay * hraPercentOfBasic) / 100;
  const variablePay = toNumber(salary.variable_pay, monthlyGross - basicPay - hraAmount);

  return {
    monthlyCtc,
    monthlyGross: Math.max(0, monthlyGross),
    basicPay: Math.max(0, basicPay),
    variablePay: Math.max(0, variablePay),
    employerEpf: Math.max(0, employerEpf),
    esiAmount: Math.max(0, esiAmount),
    effectiveBasicPercent: Math.max(0, effectiveBasicPercent),
    hraPercentOfBasic: Math.max(0, hraPercentOfBasic)
  };
};

const findFormulaForComponent = (formulaMap, scope, componentId) => {
  const entries = formulaMap.get(`${scope}:${componentId}`) || [];
  if (!entries.length) return null;
  return entries[0];
};

const tokenizeIdentifiers = (expression) => {
  const matches = String(expression).match(/[A-Za-z_][A-Za-z0-9_]*/g);
  return matches ? [...new Set(matches)] : [];
};

const evaluateFormula = (expression, context = {}) => {
  const expr = String(expression || "").trim();
  if (!expr) return 0;

  if (/['"`;{}\[\]\\]/.test(expr)) {
    throw new Error("Unsupported token in formula expression");
  }

  const helpers = {
    min: Math.min,
    max: Math.max,
    round: Math.round,
    ceil: Math.ceil,
    floor: Math.floor,
    abs: Math.abs,
    pow: Math.pow
  };

  const mergedContext = { ...helpers, ...context };
  const identifiers = tokenizeIdentifiers(expr);
  const allowedNames = new Set(Object.keys(mergedContext));

  for (const token of identifiers) {
    if (!allowedNames.has(token)) {
      throw new Error(`Unknown variable in formula: ${token}`);
    }
  }

  const argNames = Object.keys(mergedContext);
  const argValues = argNames.map((key) => mergedContext[key]);
  const fn = new Function(...argNames, `"use strict"; return (${expr});`);
  const result = fn(...argValues);
  return toNumber(result, 0);
};

const computeSlabAmount = (baseValue, slabs) => {
  if (!Array.isArray(slabs) || !slabs.length) return 0;
  const input = toNumber(baseValue, 0);
  let amount = 0;

  for (const slab of slabs) {
    const upto = slab?.upto == null ? null : toNumber(slab.upto);
    const fixedAmount = toNumber(slab.amount, 0);
    const rate = toNumber(slab.rate, 0);
    if (upto == null || input <= upto) {
      amount = fixedAmount || (input * rate) / 100;
      break;
    }
  }

  return amount;
};

const resolveComponentAmount = ({
  component,
  scope,
  formulaMap,
  context,
  prorationFactor,
  shouldProrateEarning
}) => {
  const metadata = parseJson(component.metadata, {});
  const formula = findFormulaForComponent(formulaMap, scope, component.id);
  let amount = 0;

  if (formula?.formula_expression) {
    const formulaVars = parseJson(formula.formula_variables, {});
    amount = evaluateFormula(formula.formula_expression, { ...context, ...formulaVars });
  } else if (component.calculation_mode === "percentage") {
    const baseKey = String(metadata.base || "MONTHLY_GROSS");
    const percentage = toNumber(metadata.percentage, 0);
    amount = (toNumber(context[baseKey], 0) * percentage) / 100;
  } else if (component.calculation_mode === "slab") {
    const baseKey = String(metadata.base || "MONTHLY_GROSS");
    amount = computeSlabAmount(toNumber(context[baseKey], 0), metadata.slabs);
  } else if (component.calculation_mode === "formula") {
    amount = evaluateFormula(String(metadata.expression || "0"), context);
  } else {
    amount = toNumber(
      metadata.monthlyAmount ?? metadata.amount ?? metadata.defaultAmount ?? 0,
      0
    );
  }

  if (scope === "earning" && shouldProrateEarning(component, metadata)) {
    amount *= prorationFactor;
  }

  const maxAmount = toNumber(metadata.maxAmount, 0);
  if (maxAmount > 0) {
    amount = Math.min(amount, maxAmount);
  }
  if (component.cap_amount != null) {
    amount = Math.min(amount, toNumber(component.cap_amount, amount));
  }

  return roundAmount(amount, component.rounding_policy);
};

const sortByPriority = (rows) =>
  [...rows].sort((a, b) => toNumber(a.priority, 100) - toNumber(b.priority, 100));

const mapByEmployee = (rows, key = "employee_external_id") => {
  const map = new Map();
  for (const row of rows) {
    const employeeId = String(row[key]);
    if (!map.has(employeeId)) map.set(employeeId, []);
    map.get(employeeId).push(row);
  }
  return map;
};

const normalizeComponentRows = (rows) => {
  const merged = new Map();
  for (const row of rows) {
    const key = `${row.component_scope}|${row.component_code}|${row.source_type}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...row,
        metadata: { ...(row.metadata || {}) }
      });
      continue;
    }

    existing.amount = roundAmount(toNumber(existing.amount, 0) + toNumber(row.amount, 0), "exact");
    existing.quantity = existing.quantity == null && row.quantity == null
      ? null
      : toNumber(existing.quantity, 0) + toNumber(row.quantity, 0);
    existing.rate = row.rate ?? existing.rate ?? null;
    existing.taxable = Boolean(existing.taxable || row.taxable);
    existing.affects_net_pay = Boolean(existing.affects_net_pay || row.affects_net_pay);
    existing.remarks = [existing.remarks, row.remarks].filter(Boolean).join(" | ") || null;
    existing.metadata = {
      ...(existing.metadata || {}),
      mergedLineCount: toNumber(existing.metadata?.mergedLineCount, 1) + 1
    };
  }

  return [...merged.values()];
};

const insertRunComponents = async (client, runEmployeeId, actorId, rows) => {
  if (!rows.length) return;

  const columns = [
    "tenant_id",
    "payroll_run_id",
    "payroll_run_employee_id",
    "component_scope",
    "component_code",
    "component_name",
    "source_type",
    "calculation_mode",
    "quantity",
    "rate",
    "amount",
    "taxable",
    "affects_net_pay",
    "formula_snapshot",
    "remarks",
    "metadata",
    "created_by",
    "updated_by"
  ];

  const params = [];
  const values = [];
  let p = 1;
  for (const row of rows) {
    params.push(
      `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
    );
    values.push(
      row.tenant_id,
      row.payroll_run_id,
      runEmployeeId,
      row.component_scope,
      row.component_code,
      row.component_name,
      row.source_type,
      row.calculation_mode,
      row.quantity ?? null,
      row.rate ?? null,
      row.amount,
      row.taxable,
      row.affects_net_pay,
      row.formula_snapshot ? JSON.stringify(row.formula_snapshot) : null,
      row.remarks || null,
      JSON.stringify(row.metadata || {}),
      actorId,
      actorId
    );
  }

  await client.query(
    `INSERT INTO payroll_run_components (${columns.join(",")}) VALUES ${params.join(",")}`,
    values
  );
};

const getTenantId = async (client, organizationId) => {
  const result = await client.query(
    `SELECT id FROM payroll_tenants WHERE organization_id = $1`,
    [String(organizationId)]
  );
  return result.rows[0]?.id || null;
};

exports.computePayrollRun = async (req) => {
  const startedAt = Date.now();
  const runId = String(req.params.runId);
  const organizationId = String(req.user.organizationId);
  const actorId = String(req.user.userId);
  const { employeeIds = [], forceRecompute = false, _executionMode = "sync" } = req.body;

  const pool = await getPayrollPgPool();
  if (!pool) throw { code: 400, message: "Payroll Postgres is not enabled" };

  const client = await pool.connect();
  try {
    logger.info("payroll.compute.started", {
      runId,
      organizationId,
      actorId,
      forceRecompute,
      executionMode: _executionMode,
      employeeFilterCount: employeeIds.length
    });

    await client.query("BEGIN");
    const tenantId = await getTenantIdForOrganization(client, organizationId, {
      actorId
    });

    const runResult = await client.query(
      `
        SELECT *
        FROM payroll_runs
        WHERE id = $1 AND tenant_id = $2
        FOR UPDATE
      `,
      [runId, tenantId]
    );
    const run = runResult.rows[0];
    if (!run) throw { code: 404, message: "Payroll run not found" };
    if (["locked", "paid", "cancelled"].includes(run.status)) {
      throw { code: 409, message: `Payroll run cannot be recomputed in status: ${run.status}` };
    }

    const settingsResult = await client.query(
      `SELECT * FROM payroll_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const settings = settingsResult.rows[0] || {};

    const month = run.pay_month;
    const periodEnd = monthEndDate(month);
    const filterByEmployees = employeeIds.length > 0;

    const snapshotsResult = await client.query(
      `
        SELECT *
        FROM payroll_attendance_snapshots
        WHERE tenant_id = $1
          AND pay_month = $2
          ${filterByEmployees ? "AND employee_external_id = ANY($3::varchar[])" : ""}
      `,
      filterByEmployees ? [tenantId, month, employeeIds] : [tenantId, month]
    );
    const snapshots = snapshotsResult.rows;
    if (!snapshots.length) {
      throw { code: 400, message: `No attendance snapshots found for pay month ${month}` };
    }

    const employeeExternalIds = snapshots.map((row) => String(row.employee_external_id));

    const profileResult = await client.query(
      `
        SELECT id, employee_external_id
        FROM employee_payroll_profiles
        WHERE tenant_id = $1
          AND employee_external_id = ANY($2::varchar[])
      `,
      [tenantId, employeeExternalIds]
    );
    const profileMap = new Map(
      profileResult.rows.map((row) => [String(row.employee_external_id), String(row.id)])
    );

    const profileIds = profileResult.rows.map((row) => row.id);
    const salaryResult =
      profileIds.length > 0
        ? await client.query(
            `
              SELECT DISTINCT ON (employee_payroll_profile_id) *
              FROM employee_salary_structures
              WHERE employee_payroll_profile_id = ANY($1::uuid[])
                AND effective_from <= $2::date
                AND (effective_to IS NULL OR effective_to >= $2::date)
              ORDER BY employee_payroll_profile_id, effective_from DESC, version_no DESC
            `,
            [profileIds, periodEnd.toISOString().slice(0, 10)]
          )
        : { rows: [] };
    const salaryByProfile = new Map(
      salaryResult.rows.map((row) => [String(row.employee_payroll_profile_id), row])
    );

    const [earningsResult, deductionsResult, employerResult, formulasResult] = await Promise.all([
      client.query(
        `
          SELECT *
          FROM earning_components
          WHERE tenant_id = $1
            AND is_active = true
            AND effective_from <= $2::date
            AND (effective_to IS NULL OR effective_to >= $2::date)
        `,
        [tenantId, periodEnd.toISOString().slice(0, 10)]
      ),
      client.query(
        `
          SELECT *
          FROM deduction_components
          WHERE tenant_id = $1
            AND is_active = true
            AND effective_from <= $2::date
            AND (effective_to IS NULL OR effective_to >= $2::date)
        `,
        [tenantId, periodEnd.toISOString().slice(0, 10)]
      ),
      client.query(
        `
          SELECT *
          FROM employer_contribution_components
          WHERE tenant_id = $1
            AND is_active = true
            AND effective_from <= $2::date
            AND (effective_to IS NULL OR effective_to >= $2::date)
        `,
        [tenantId, periodEnd.toISOString().slice(0, 10)]
      ),
      client.query(
        `
          SELECT *
          FROM component_formulas
          WHERE tenant_id = $1
            AND is_active = true
            AND effective_from <= $2::date
            AND (effective_to IS NULL OR effective_to >= $2::date)
          ORDER BY execution_order ASC, version_no DESC, effective_from DESC
        `,
        [tenantId, periodEnd.toISOString().slice(0, 10)]
      )
    ]);

    const earningComponents = sortByPriority(earningsResult.rows);
    const deductionComponents = sortByPriority(deductionsResult.rows);
    const employerComponents = sortByPriority(employerResult.rows);
    const formulaMap = new Map();
    for (const row of formulasResult.rows) {
      const componentId =
        row.earning_component_id ||
        row.deduction_component_id ||
        row.employer_contribution_component_id;
      const key = `${row.component_scope}:${componentId}`;
      if (!formulaMap.has(key)) formulaMap.set(key, []);
      formulaMap.get(key).push(row);
    }

    const adjustmentsResult = await client.query(
      `
        SELECT *
        FROM payroll_adjustments
        WHERE tenant_id = $1
          AND effective_month = $2
          AND approval_status = 'approved'
          AND employee_external_id = ANY($3::varchar[])
          AND (payroll_run_id IS NULL OR payroll_run_id = $4)
      `,
      [tenantId, month, employeeExternalIds, runId]
    );
    const arrearsResult = await client.query(
      `
        SELECT *
        FROM payroll_arrears
        WHERE tenant_id = $1
          AND current_effective_month = $2
          AND status IN ('pending', 'processed')
          AND employee_external_id = ANY($3::varchar[])
          AND (payroll_run_id IS NULL OR payroll_run_id = $4)
      `,
      [tenantId, month, employeeExternalIds, runId]
    );
    const reimbursementsResult = await client.query(
      `
        SELECT *
        FROM payroll_reimbursements
        WHERE tenant_id = $1
          AND effective_month = $2
          AND payout_status IN ('approved', 'paid')
          AND employee_external_id = ANY($3::varchar[])
          AND (payroll_run_id IS NULL OR payroll_run_id = $4)
      `,
      [tenantId, month, employeeExternalIds, runId]
    );
    const loansResult = await client.query(
      `
        SELECT *
        FROM payroll_loans
        WHERE tenant_id = $1
          AND employee_external_id = ANY($2::varchar[])
          AND loan_status = 'active'
          AND start_month <= $3
          AND (end_month IS NULL OR end_month >= $3)
          AND (payroll_run_id IS NULL OR payroll_run_id = $4)
      `,
      [tenantId, employeeExternalIds, month, runId]
    );

    const adjustmentsByEmployee = mapByEmployee(adjustmentsResult.rows);
    const arrearsByEmployee = mapByEmployee(arrearsResult.rows);
    const reimbursementsByEmployee = mapByEmployee(reimbursementsResult.rows);
    const loansByEmployee = mapByEmployee(loansResult.rows);

    let grossTotal = 0;
    let deductionTotal = 0;
    let reimbursementTotal = 0;
    let employerContributionTotal = 0;
    let netPayTotal = 0;
    let processedCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    const shouldProrateEarning = (component, metadata) =>
      component.prorate_with_attendance !== false &&
      metadata.prorateWithAttendance !== false &&
      metadata.ignoreProration !== true;

    for (const snapshot of snapshots) {
      const employeeExternalId = String(snapshot.employee_external_id);
      const runEmployeeWarnings = [];

      try {
        const upsertEmployee = await client.query(
          `
            INSERT INTO payroll_run_employees (
              tenant_id,
              payroll_run_id,
              employee_external_id,
              employee_payroll_profile_id,
              attendance_snapshot_id,
              payroll_status,
              payable_days,
              lop_days,
              overtime_minutes,
              warnings,
              created_by,
              updated_by
            )
            VALUES (
              $1,$2,$3,$4,$5,'pending',$6,$7,$8,'[]'::jsonb,$9,$9
            )
            ON CONFLICT (payroll_run_id, employee_external_id)
            DO UPDATE SET
              employee_payroll_profile_id = EXCLUDED.employee_payroll_profile_id,
              attendance_snapshot_id = EXCLUDED.attendance_snapshot_id,
              payroll_status = 'pending',
              payable_days = EXCLUDED.payable_days,
              lop_days = EXCLUDED.lop_days,
              overtime_minutes = EXCLUDED.overtime_minutes,
              error_message = NULL,
              warnings = '[]'::jsonb,
              updated_by = EXCLUDED.updated_by
            RETURNING id
          `,
          [
            tenantId,
            runId,
            employeeExternalId,
            profileMap.get(employeeExternalId) || null,
            snapshot.id,
            toNumber(snapshot.payable_days, 0),
            toNumber(snapshot.lop_days, 0),
            toNumber(snapshot.overtime_minutes, 0),
            actorId
          ]
        );
        const runEmployeeId = upsertEmployee.rows[0].id;

        await client.query(
          `DELETE FROM payroll_run_components WHERE payroll_run_employee_id = $1`,
          [runEmployeeId]
        );

        const profileId = profileMap.get(employeeExternalId);
        const salary = profileId ? salaryByProfile.get(profileId) : null;
        if (!salary) {
          throw new Error("Active salary structure not found for employee profile");
        }

        const salaryContext = computeSalaryContextFromRules({ salary });
        const monthlyGross = salaryContext.monthlyGross;
        const basicPay = salaryContext.basicPay;
        const variablePay = salaryContext.variablePay;
        const calendarDays = Math.max(1, toNumber(snapshot.calendar_days, 30));
        const workingDays = Math.max(1, toNumber(snapshot.working_days, calendarDays));
        const payableDays = toNumber(snapshot.payable_days, 0);
        const lopDays = toNumber(snapshot.lop_days, 0);
        const overtimeMinutes = toNumber(snapshot.overtime_minutes, 0);
        const minWorkMinutes = Math.max(1, toNumber(snapshot.min_work_minutes, 480));
        const denominator =
          settings.lop_calculation_method === "working_days" ? workingDays : calendarDays;
        const prorationFactor = Math.max(0, Math.min(1, payableDays / Math.max(1, denominator)));
        const lopFactor = Math.max(0, Math.min(1, lopDays / Math.max(1, denominator)));
        const perDayRate = monthlyGross / Math.max(1, denominator);
        const perMinuteRate = perDayRate / minWorkMinutes;
        const overtimeRateMultiplier = Number(process.env.PAYROLL_OT_MULTIPLIER || 1);
        const overtimeAmountAuto = roundAmount(
          overtimeMinutes * perMinuteRate * overtimeRateMultiplier,
          settings.rounding_policy || "nearest_rupee"
        );

        const baseContext = {
          MONTHLY_GROSS: monthlyGross,
          MONTHLY_CTC: salaryContext.monthlyCtc,
          ANNUAL_CTC: toNumber(salary.annual_ctc, 0),
          BASIC_PAY: basicPay,
          VARIABLE_PAY: variablePay,
          EMPLOYER_EPF: salaryContext.employerEpf,
          ESI_AMOUNT: salaryContext.esiAmount,
          EFFECTIVE_BASIC_PERCENT: salaryContext.effectiveBasicPercent,
          HRA_PERCENT_OF_BASIC: salaryContext.hraPercentOfBasic,
          PAYABLE_DAYS: payableDays,
          LOP_DAYS: lopDays,
          OVERTIME_MINUTES: overtimeMinutes,
          OVERTIME_HOURS: overtimeMinutes / 60,
          CALENDAR_DAYS: calendarDays,
          WORKING_DAYS: workingDays,
          PRORATION_FACTOR: prorationFactor,
          LOP_FACTOR: lopFactor,
          PER_DAY_RATE: perDayRate,
          PER_MINUTE_RATE: perMinuteRate
        };

        const componentRows = [];
        const computedVars = { ...baseContext };
        let regularEarnings = 0;
        let regularDeductions = 0;
        let regularEmployer = 0;
        let taxableIncome = 0;
        let tdsAmount = 0;

        for (const component of earningComponents) {
          const amount = resolveComponentAmount({
            component,
            scope: "earning",
            formulaMap,
            context: computedVars,
            prorationFactor,
            shouldProrateEarning
          });
          if (!amount) continue;

          regularEarnings += amount;
          if (component.taxable) taxableIncome += amount;

          const key = toVarKey(component.code);
          computedVars[key] = amount;

          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: "earning",
            component_code: component.code,
            component_name: component.name,
            source_type: "system",
            calculation_mode: component.calculation_mode,
            amount,
            taxable: Boolean(component.taxable),
            affects_net_pay: true,
            formula_snapshot: null,
            metadata: {}
          });
        }

        if (overtimeAmountAuto > 0 && !componentRows.some((row) => row.component_code === "OT")) {
          regularEarnings += overtimeAmountAuto;
          taxableIncome += overtimeAmountAuto;
          computedVars.OT = overtimeAmountAuto;
          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: "earning",
            component_code: "OT_AUTO",
            component_name: "Overtime (Auto)",
            source_type: "system",
            calculation_mode: "formula",
            quantity: overtimeMinutes,
            rate: perMinuteRate * overtimeRateMultiplier,
            amount: overtimeAmountAuto,
            taxable: true,
            affects_net_pay: true,
            formula_snapshot: {
              expression: "OVERTIME_MINUTES * PER_MINUTE_RATE * OT_MULTIPLIER",
              OT_MULTIPLIER: overtimeRateMultiplier
            },
            metadata: {}
          });
        }

        computedVars.GROSS_EARNINGS = regularEarnings;

        for (const component of deductionComponents) {
          const amount = resolveComponentAmount({
            component,
            scope: "deduction",
            formulaMap,
            context: computedVars,
            prorationFactor,
            shouldProrateEarning
          });
          if (!amount) continue;

          regularDeductions += amount;
          if (String(component.code || "").toUpperCase() === "TDS") {
            tdsAmount += amount;
          }

          const key = toVarKey(component.code);
          computedVars[key] = amount;

          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: "deduction",
            component_code: component.code,
            component_name: component.name,
            source_type: "system",
            calculation_mode: component.calculation_mode,
            amount,
            taxable: false,
            affects_net_pay: true,
            formula_snapshot: null,
            metadata: {}
          });
        }

        for (const component of employerComponents) {
          const amount = resolveComponentAmount({
            component,
            scope: "employer_contribution",
            formulaMap,
            context: computedVars,
            prorationFactor,
            shouldProrateEarning
          });
          if (!amount) continue;

          regularEmployer += amount;

          const key = toVarKey(component.code);
          computedVars[key] = amount;

          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: "employer_contribution",
            component_code: component.code,
            component_name: component.name,
            source_type: "system",
            calculation_mode: component.calculation_mode,
            amount,
            taxable: false,
            affects_net_pay: false,
            formula_snapshot: null,
            metadata: {}
          });
        }

        const adjustments = adjustmentsByEmployee.get(employeeExternalId) || [];
        const arrears = arrearsByEmployee.get(employeeExternalId) || [];
        const reimbursements = reimbursementsByEmployee.get(employeeExternalId) || [];
        const loans = loansByEmployee.get(employeeExternalId) || [];

        let adjustmentAmount = 0;
        let arrearsAmount = 0;
        let reimbursementAmount = 0;
        let loanDeductionAmount = 0;

        for (const row of adjustments) {
          const amount = toNumber(row.amount, 0);
          if (!amount) continue;
          const sign = row.adjustment_type === "deduction" ? -1 : 1;
          adjustmentAmount += sign * amount;

          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: row.adjustment_type === "deduction" ? "deduction" : "earning",
            component_code: row.adjustment_code,
            component_name: row.adjustment_code,
            source_type: "manual",
            calculation_mode: "fixed",
            amount,
            taxable: Boolean(row.taxable),
            affects_net_pay: true,
            remarks: row.description,
            metadata: { adjustmentId: row.id }
          });
        }

        for (const row of arrears) {
          const amount = Math.abs(toNumber(row.difference_amount, 0));
          if (!amount) continue;
          const sign = row.arrear_type === "deduction" ? -1 : 1;
          arrearsAmount += sign * amount;

          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: row.arrear_type === "deduction" ? "deduction" : "earning",
            component_code: row.component_code,
            component_name: `${row.component_code} Arrear`,
            source_type: "arrear",
            calculation_mode: "fixed",
            amount,
            taxable: Boolean(row.taxable),
            affects_net_pay: true,
            metadata: { arrearId: row.id }
          });
        }

        for (const row of reimbursements) {
          const amount = toNumber(row.approved_amount, 0);
          if (!amount) continue;
          reimbursementAmount += amount;

          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: "reimbursement",
            component_code: row.reimbursement_code,
            component_name: row.reimbursement_code,
            source_type: "reimbursement",
            calculation_mode: "fixed",
            amount,
            taxable: Boolean(row.taxable),
            affects_net_pay: true,
            remarks: row.description,
            metadata: { reimbursementId: row.id }
          });
        }

        for (const row of loans) {
          const installment = toNumber(row.installment_amount, 0);
          const outstanding = toNumber(row.outstanding_amount, 0);
          const deducted = Math.min(
            outstanding,
            Math.max(0, toNumber(row.deducted_amount_this_run, installment))
          );
          if (!deducted) continue;
          loanDeductionAmount += deducted;

          componentRows.push({
            tenant_id: tenantId,
            payroll_run_id: runId,
            component_scope: "deduction",
            component_code: "LOAN",
            component_name: `Loan Deduction (${row.loan_reference_no})`,
            source_type: "loan",
            calculation_mode: "fixed",
            amount: deducted,
            taxable: false,
            affects_net_pay: true,
            metadata: { loanId: row.id, loanReferenceNo: row.loan_reference_no }
          });
        }

        const grossEarnings = roundAmount(
          regularEarnings +
            Math.max(0, adjustmentAmount) +
            Math.max(0, arrearsAmount),
          settings.rounding_policy || "nearest_rupee"
        );
        const totalDeductions = roundAmount(
          regularDeductions +
            Math.max(0, -adjustmentAmount) +
            Math.max(0, -arrearsAmount) +
            loanDeductionAmount,
          settings.rounding_policy || "nearest_rupee"
        );
        const netPay = roundAmount(
          grossEarnings + reimbursementAmount - totalDeductions,
          settings.rounding_policy || "nearest_rupee"
        );

        if (netPay < 0) {
          runEmployeeWarnings.push("Net pay is negative after deductions");
        }
        if (prorationFactor < 1 && lopDays > 0) {
          runEmployeeWarnings.push("LOP applied through attendance snapshot");
        }

        await client.query(
          `
            UPDATE payroll_run_employees
            SET
              payroll_status = 'processed',
              payable_days = $2,
              lop_days = $3,
              overtime_minutes = $4,
              arrears_amount = $5,
              adjustment_amount = $6,
              reimbursement_amount = $7,
              loan_deduction_amount = $8,
              gross_earnings = $9,
              total_deductions = $10,
              employer_contributions = $11,
              taxable_income = $12,
              tds_amount = $13,
              net_pay = $14,
              warnings = $15::jsonb,
              error_message = NULL,
              updated_by = $16
            WHERE id = $1
          `,
          [
            runEmployeeId,
            payableDays,
            lopDays,
            overtimeMinutes,
            roundAmount(arrearsAmount, settings.rounding_policy),
            roundAmount(adjustmentAmount, settings.rounding_policy),
            roundAmount(reimbursementAmount, settings.rounding_policy),
            roundAmount(loanDeductionAmount, settings.rounding_policy),
            grossEarnings,
            totalDeductions,
            roundAmount(regularEmployer, settings.rounding_policy),
            roundAmount(taxableIncome, settings.rounding_policy),
            roundAmount(tdsAmount, settings.rounding_policy),
            netPay,
            JSON.stringify(runEmployeeWarnings),
            actorId
          ]
        );

        await insertRunComponents(
          client,
          runEmployeeId,
          actorId,
          normalizeComponentRows(componentRows)
        );

        if (adjustments.length) {
          await client.query(
            `
              UPDATE payroll_adjustments
              SET payroll_run_id = $1, payroll_run_employee_id = $2, updated_by = $3
              WHERE id = ANY($4::uuid[])
            `,
            [runId, runEmployeeId, actorId, adjustments.map((row) => row.id)]
          );
        }

        if (arrears.length) {
          await client.query(
            `
              UPDATE payroll_arrears
              SET payroll_run_id = $1, payroll_run_employee_id = $2, status = 'processed', updated_by = $3
              WHERE id = ANY($4::uuid[])
            `,
            [runId, runEmployeeId, actorId, arrears.map((row) => row.id)]
          );
        }

        if (reimbursements.length) {
          await client.query(
            `
              UPDATE payroll_reimbursements
              SET payroll_run_id = $1, payroll_run_employee_id = $2, payout_status = 'paid', updated_by = $3
              WHERE id = ANY($4::uuid[])
            `,
            [runId, runEmployeeId, actorId, reimbursements.map((row) => row.id)]
          );
        }

        if (loans.length) {
          await client.query(
            `
              UPDATE payroll_loans
              SET
                payroll_run_id = $1,
                payroll_run_employee_id = $2,
                deducted_amount_this_run = LEAST(outstanding_amount, GREATEST(0, COALESCE(deducted_amount_this_run, installment_amount))),
                outstanding_amount = GREATEST(0, outstanding_amount - LEAST(outstanding_amount, GREATEST(0, COALESCE(deducted_amount_this_run, installment_amount)))),
                current_installment_no = current_installment_no + 1,
                loan_status = CASE
                  WHEN GREATEST(0, outstanding_amount - LEAST(outstanding_amount, GREATEST(0, COALESCE(deducted_amount_this_run, installment_amount)))) = 0 THEN 'closed'
                  ELSE loan_status
                END,
                updated_by = $3
              WHERE id = ANY($4::uuid[])
            `,
            [runId, runEmployeeId, actorId, loans.map((row) => row.id)]
          );
        }

        grossTotal += grossEarnings;
        deductionTotal += totalDeductions;
        reimbursementTotal += reimbursementAmount;
        employerContributionTotal += regularEmployer;
        netPayTotal += netPay;
        processedCount += 1;
        warningCount += runEmployeeWarnings.length;
      } catch (error) {
        errorCount += 1;
        const message = error?.message || "Payroll computation failed";
        await client.query(
          `
            UPDATE payroll_run_employees
            SET payroll_status = 'error', error_message = $2, updated_by = $3
            WHERE payroll_run_id = $1 AND employee_external_id = $4
          `,
          [runId, message, actorId, employeeExternalId]
        );
      }
    }

    const runStatus = errorCount > 0 ? "validation_failed" : "ready_for_approval";
    await client.query(
      `
        UPDATE payroll_runs
        SET
          status = $2,
          attendance_snapshot_status = 'fetched',
          employee_count = $3,
          processed_employee_count = $4,
          warning_count = $5,
          error_count = $6,
          gross_total = $7,
          deduction_total = $8,
          reimbursement_total = $9,
          employer_contribution_total = $10,
          net_pay_total = $11,
          updated_by = $12
        WHERE id = $1
      `,
      [
        runId,
        runStatus,
        snapshots.length,
        processedCount,
        warningCount,
        errorCount,
        roundAmount(grossTotal, settings.rounding_policy),
        roundAmount(deductionTotal, settings.rounding_policy),
        roundAmount(reimbursementTotal, settings.rounding_policy),
        roundAmount(employerContributionTotal, settings.rounding_policy),
        roundAmount(netPayTotal, settings.rounding_policy),
        actorId
      ]
    );

    await client.query("COMMIT");
    const response = {
      runId,
      payMonth: month,
      forceRecompute,
      status: runStatus,
      totalEmployees: snapshots.length,
      processedEmployees: processedCount,
      errorEmployees: errorCount,
      warningCount,
      totals: {
        gross: roundAmount(grossTotal, settings.rounding_policy),
        deductions: roundAmount(deductionTotal, settings.rounding_policy),
        reimbursements: roundAmount(reimbursementTotal, settings.rounding_policy),
        employerContributions: roundAmount(employerContributionTotal, settings.rounding_policy),
        netPay: roundAmount(netPayTotal, settings.rounding_policy)
      }
    };

    observePayrollCompute({
      outcome: "success",
      mode: _executionMode,
      durationMs: Date.now() - startedAt
    });
    logger.info("payroll.compute.completed", {
      runId,
      organizationId,
      status: response.status,
      durationMs: Date.now() - startedAt,
      processedEmployees: response.processedEmployees,
      errorEmployees: response.errorEmployees
    });
    return response;
  } catch (error) {
    await safeRollback(client);
    observePayrollCompute({
      outcome: "failure",
      mode: req.body?._executionMode || "sync",
      durationMs: Date.now() - startedAt
    });
    logger.error("payroll.compute.failed", {
      runId,
      organizationId,
      durationMs: Date.now() - startedAt,
      message: error?.message || error
    });
    throw error;
  } finally {
    client.release();
  }
};

exports.__test__ = {
  toNumber,
  monthEndDate,
  roundAmount,
  toVarKey,
  parseJson,
  tokenizeIdentifiers,
  evaluateFormula,
  computeSlabAmount,
  resolveComponentAmount,
  normalizeComponentRows
};
