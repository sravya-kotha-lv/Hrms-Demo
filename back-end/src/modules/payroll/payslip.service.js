const { getPayrollPgPool } = require("../../config/payrollDb");
const Employee = require("../employees/employee.model");
const Organization = require("../organizations/organization.model");
const { getTenantIdForOrganization } = require("./payrollProvisioning.service");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTenantId = async (client, organizationId) => {
  const result = await client.query(
    `SELECT id FROM payroll_tenants WHERE organization_id = $1`,
    [String(organizationId)]
  );
  return result.rows[0]?.id || null;
};

const parseMonth = (month) => {
  const [year, monthNum] = String(month).split("-").map(Number);
  return { year, monthNum };
};

const monthStart = (year) => `${year}-01`;

const aggregateByComponent = (rows) => {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.component_scope}|${row.component_code}`;
    const prev = map.get(key) || 0;
    map.set(key, prev + toNumber(row.amount, 0));
  }
  return [...map.entries()].map(([key, amount]) => {
    const [scope, code] = key.split("|");
    return {
      scope,
      code,
      amount: Number(amount.toFixed(2))
    };
  });
};

const buildLineItems = (components, scope) =>
  components
    .filter((row) => row.component_scope === scope)
    .map((row) => ({
      code: row.component_code,
      name: row.component_name,
      amount: toNumber(row.amount, 0),
      sourceType: row.source_type,
      taxable: Boolean(row.taxable)
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

const getEmployeeBrief = async (organizationId, employeeExternalId) => {
  const employee = await Employee.findOne({
    _id: employeeExternalId,
    organizationId
  })
    .select("firstName lastName employeeCode dateOfJoining")
    .lean();
  return employee || null;
};

const getOrganizationBrief = async (organizationId) => {
  const org = await Organization.findById(organizationId)
    .select("name code currency timezone")
    .lean();
  return org || null;
};

const fetchRunContext = async (client, tenantId, runId, employeeExternalId) => {
  const runResult = await client.query(
    `
      SELECT *
      FROM payroll_runs
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
    `,
    [runId, tenantId]
  );
  const run = runResult.rows[0];
  if (!run) throw { code: 404, message: "Payroll run not found" };

  const runEmployeeResult = await client.query(
    `
      SELECT *
      FROM payroll_run_employees
      WHERE payroll_run_id = $1
        AND employee_external_id = $2
      LIMIT 1
    `,
    [runId, employeeExternalId]
  );
  const runEmployee = runEmployeeResult.rows[0];
  if (!runEmployee) {
    throw { code: 404, message: "Payroll run employee entry not found for requested employee" };
  }

  const componentsResult = await client.query(
    `
      SELECT *
      FROM payroll_run_components
      WHERE payroll_run_employee_id = $1
      ORDER BY component_scope, component_code
    `,
    [runEmployee.id]
  );

  const attendanceResult = runEmployee.attendance_snapshot_id
    ? await client.query(
        `
          SELECT *
          FROM payroll_attendance_snapshots
          WHERE id = $1
          LIMIT 1
        `,
        [runEmployee.attendance_snapshot_id]
      )
    : { rows: [] };

  const profileResult = runEmployee.employee_payroll_profile_id
    ? await client.query(
        `
          SELECT *
          FROM employee_payroll_profiles
          WHERE id = $1
          LIMIT 1
        `,
        [runEmployee.employee_payroll_profile_id]
      )
    : { rows: [] };

  const bankResult = runEmployee.employee_payroll_profile_id
    ? await client.query(
        `
          SELECT *
          FROM employee_bank_details
          WHERE employee_payroll_profile_id = $1
          ORDER BY is_primary DESC, version_no DESC
          LIMIT 1
        `,
        [runEmployee.employee_payroll_profile_id]
      )
    : { rows: [] };

  const statutoryResult = runEmployee.employee_payroll_profile_id
    ? await client.query(
        `
          SELECT *
          FROM employee_statutory_details
          WHERE employee_payroll_profile_id = $1
          ORDER BY version_no DESC
          LIMIT 1
        `,
        [runEmployee.employee_payroll_profile_id]
      )
    : { rows: [] };

  return {
    run,
    runEmployee,
    components: componentsResult.rows,
    attendance: attendanceResult.rows[0] || null,
    profile: profileResult.rows[0] || null,
    bank: bankResult.rows[0] || null,
    statutory: statutoryResult.rows[0] || null
  };
};

const fetchYtd = async (client, tenantId, run, employeeExternalId) => {
  const { year } = parseMonth(run.pay_month);
  const ytdStart = monthStart(year);

  const totalsResult = await client.query(
    `
      SELECT
        COALESCE(SUM(re.gross_earnings), 0) AS gross_earnings,
        COALESCE(SUM(re.total_deductions), 0) AS total_deductions,
        COALESCE(SUM(re.reimbursement_amount), 0) AS reimbursements,
        COALESCE(SUM(re.employer_contributions), 0) AS employer_contributions,
        COALESCE(SUM(re.net_pay), 0) AS net_pay
      FROM payroll_run_employees re
      INNER JOIN payroll_runs r ON r.id = re.payroll_run_id
      WHERE r.tenant_id = $1
        AND re.employee_external_id = $2
        AND r.pay_month >= $3
        AND r.pay_month <= $4
        AND r.status IN ('ready_for_approval', 'approved', 'locked', 'paid')
    `,
    [tenantId, employeeExternalId, ytdStart, run.pay_month]
  );

  const componentsResult = await client.query(
    `
      SELECT
        c.component_scope,
        c.component_code,
        c.amount
      FROM payroll_run_components c
      INNER JOIN payroll_run_employees re ON re.id = c.payroll_run_employee_id
      INNER JOIN payroll_runs r ON r.id = c.payroll_run_id
      WHERE r.tenant_id = $1
        AND re.employee_external_id = $2
        AND r.pay_month >= $3
        AND r.pay_month <= $4
        AND r.status IN ('ready_for_approval', 'approved', 'locked', 'paid')
    `,
    [tenantId, employeeExternalId, ytdStart, run.pay_month]
  );

  const totals = totalsResult.rows[0] || {};
  return {
    period: {
      fromMonth: ytdStart,
      toMonth: run.pay_month
    },
    totals: {
      grossEarnings: toNumber(totals.gross_earnings, 0),
      totalDeductions: toNumber(totals.total_deductions, 0),
      reimbursements: toNumber(totals.reimbursements, 0),
      employerContributions: toNumber(totals.employer_contributions, 0),
      netPay: toNumber(totals.net_pay, 0)
    },
    components: aggregateByComponent(componentsResult.rows)
  };
};

const buildPayslipPayload = ({
  organization,
  employee,
  run,
  runEmployee,
  components,
  attendance,
  profile,
  bank,
  statutory,
  ytd
}) => {
  const earnings = buildLineItems(components, "earning");
  const deductions = buildLineItems(components, "deduction");
  const reimbursements = buildLineItems(components, "reimbursement");
  const employerContributions = buildLineItems(components, "employer_contribution");

  const attendanceSummary = attendance
    ? {
        month: run.pay_month,
        calendarDays: toNumber(attendance.calendar_days, 0),
        workingDays: toNumber(attendance.working_days, 0),
        payableDays: toNumber(attendance.payable_days, 0),
        lopDays: toNumber(attendance.lop_days, 0),
        presentDays: toNumber(attendance.present_days, 0),
        halfDays: toNumber(attendance.half_days, 0),
        paidLeaveDays: toNumber(attendance.paid_leave_days, 0),
        unpaidLeaveDays: toNumber(attendance.unpaid_leave_days, 0),
        holidayDays: toNumber(attendance.holiday_days, 0),
        weekOffDays: toNumber(attendance.week_off_days, 0),
        overtimeMinutes: toNumber(attendance.overtime_minutes, 0),
        lateByMinutes: toNumber(attendance.late_by_minutes, 0),
        attendanceMinutes: toNumber(attendance.attendance_minutes, 0)
      }
    : null;

  const totals = {
    grossEarnings: toNumber(runEmployee.gross_earnings, 0),
    totalDeductions: toNumber(runEmployee.total_deductions, 0),
    reimbursements: toNumber(runEmployee.reimbursement_amount, 0),
    employerContributions: toNumber(runEmployee.employer_contributions, 0),
    taxableIncome: toNumber(runEmployee.taxable_income, 0),
    tds: toNumber(runEmployee.tds_amount, 0),
    netPay: toNumber(runEmployee.net_pay, 0)
  };

  const payslipJson = {
    payslipId: `${run.run_code}-${runEmployee.employee_external_id}`,
    runId: run.id,
    payMonth: run.pay_month,
    payrollStatus: run.status,
    currency: run.currency_code || "INR",
    company: {
      name: organization?.name || null,
      code: organization?.code || null,
      timezone: organization?.timezone || "Asia/Kolkata"
    },
    employee: {
      employeeExternalId: runEmployee.employee_external_id,
      employeeCode: employee?.employeeCode || profile?.employee_code || null,
      name: employee ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim() : null,
      dateOfJoining: employee?.dateOfJoining || profile?.date_of_joining || null,
      taxRegime: profile?.tax_regime || null
    },
    bank: bank
      ? {
          paymentMode: bank.payment_mode,
          accountHolderName: bank.account_holder_name,
          bankName: bank.bank_name,
          accountNumberMasked: bank.account_number
            ? `XXXXXX${String(bank.account_number).slice(-4)}`
            : null,
          ifscCode: bank.ifsc_code,
          upiId: bank.upi_id
        }
      : null,
    statutory: statutory
      ? {
          pan: statutory.pan || null,
          uan: statutory.uan || null,
          esicNumber: statutory.esic_number || null
        }
      : null,
    attendanceSummary,
    earnings,
    deductions,
    reimbursements,
    employerContributions,
    totals,
    ytd
  };

  const pdfPayload = {
    templateCode: "payslip_v1_india",
    documentMeta: {
      title: `Payslip - ${run.pay_month}`,
      generatedAt: new Date().toISOString(),
      locale: "en-IN",
      currency: run.currency_code || "INR"
    },
    header: {
      companyName: payslipJson.company.name,
      companyCode: payslipJson.company.code,
      payslipMonth: run.pay_month,
      payrollRunCode: run.run_code
    },
    employeeCard: {
      name: payslipJson.employee.name,
      employeeCode: payslipJson.employee.employeeCode,
      dateOfJoining: payslipJson.employee.dateOfJoining,
      taxRegime: payslipJson.employee.taxRegime,
      paymentMode: payslipJson.bank?.paymentMode || null
    },
    attendanceCard: attendanceSummary,
    sections: {
      earnings,
      deductions,
      reimbursements,
      employerContributions
    },
    totalsCard: totals,
    ytdCard: ytd,
    footNotes: [
      "This is a system-generated payslip.",
      "For queries contact payroll/HR team."
    ]
  };

  return {
    payslipJson,
    pdfPayload
  };
};

exports.getPayslipByRun = async (req) => {
  const pool = await getPayrollPgPool();
  if (!pool) throw { code: 400, message: "Payroll Postgres is not enabled" };

  const client = await pool.connect();
  try {
    const tenantId = await getTenantIdForOrganization(client, req.user.organizationId, {
      actorId: req.user.userId
    });

    const { runId, employeeExternalId } = req.params;
    const context = await fetchRunContext(client, tenantId, runId, employeeExternalId);
    const ytd = await fetchYtd(client, tenantId, context.run, employeeExternalId);
    const [employee, organization] = await Promise.all([
      getEmployeeBrief(req.user.organizationId, employeeExternalId),
      getOrganizationBrief(req.user.organizationId)
    ]);

    return buildPayslipPayload({
      organization,
      employee,
      ...context,
      ytd
    });
  } finally {
    client.release();
  }
};

exports.getPayslipByMonth = async (req) => {
  const pool = await getPayrollPgPool();
  if (!pool) throw { code: 400, message: "Payroll Postgres is not enabled" };

  const client = await pool.connect();
  try {
    const tenantId = await getTenantIdForOrganization(client, req.user.organizationId, {
      actorId: req.user.userId
    });

    const { month, employeeExternalId } = req.query;
    const runResult = await client.query(
      `
        SELECT r.id
        FROM payroll_runs r
        INNER JOIN payroll_run_employees re ON re.payroll_run_id = r.id
        WHERE r.tenant_id = $1
          AND r.pay_month = $2
          AND re.employee_external_id = $3
          AND r.status IN ('ready_for_approval', 'approved', 'locked', 'paid')
        ORDER BY
          CASE r.status
            WHEN 'paid' THEN 1
            WHEN 'locked' THEN 2
            WHEN 'approved' THEN 3
            ELSE 4
          END,
          r.updated_at DESC
        LIMIT 1
      `,
      [tenantId, month, employeeExternalId]
    );

    const runId = runResult.rows[0]?.id;
    if (!runId) {
      throw { code: 404, message: `Payslip not found for month ${month} and employee` };
    }

    req.params = {
      ...req.params,
      runId,
      employeeExternalId
    };
    return exports.getPayslipByRun(req);
  } finally {
    client.release();
  }
};
