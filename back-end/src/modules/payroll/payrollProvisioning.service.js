const { getPayrollPgPool } = require("../../config/payrollDb");
const OrgSettings = require("../orgSettings/orgSettings.model");
const Organization = require("../organizations/organization.model");

const DEFAULT_COUNTRY_CODE = String(process.env.PAYROLL_COUNTRY || "IN").toUpperCase();
const DEFAULT_STATE_CODE = String(process.env.PAYROLL_STATE_CODE || "TS").toUpperCase();
const DEFAULT_TIMEZONE = String(process.env.PAYROLL_DEFAULT_TIMEZONE || "Asia/Kolkata");
const DEFAULT_SALARY_PAY_DAY = Math.min(
  31,
  Math.max(1, Number(process.env.PAYROLL_DEFAULT_SALARY_PAY_DAY || 30))
);

const toDay = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(31, Math.max(1, Math.trunc(parsed)));
};

const toSafeCode = (value, fallback = "ORG") =>
  String(value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || fallback;

const getOrgSettings = async (organizationId, orgSettings = null) => {
  if (orgSettings) return orgSettings;
  return OrgSettings.findOne({ organizationId })
    .select(
      "payrollEnabled payrollCutoffDay timezone attendanceLockMode attendanceLockAfterDays"
    )
    .lean();
};

const getOrganization = async (organizationId) => {
  const organization = await Organization.findById(organizationId)
    .select("name code timezone")
    .lean();

  if (!organization) {
    throw { code: 404, message: "Organization not found" };
  }

  return organization;
};

const queryTenantId = async (client, organizationId) => {
  const result = await client.query(
    `SELECT id FROM payroll_tenants WHERE organization_id = $1`,
    [String(organizationId)]
  );
  return result.rows[0]?.id || null;
};

const ensurePool = async () => {
  const pool = await getPayrollPgPool();
  if (!pool) {
    throw {
      code: 400,
      message:
        "Payroll is enabled for this organization, but Payroll Postgres is not configured on the server."
    };
  }
  return pool;
};

const ensureDefaultPayGroup = async ({
  client,
  tenantId,
  organization,
  cutoffDay,
  actorId
}) => {
  const existingResult = await client.query(
    `
      SELECT id
      FROM pay_groups
      WHERE tenant_id = $1
      ORDER BY is_active DESC, created_at ASC
      LIMIT 1
    `,
    [tenantId]
  );

  if (existingResult.rows[0]?.id) {
    await client.query(
      `
        UPDATE pay_groups
        SET
          cutoff_day = $2,
          updated_by = $3
        WHERE tenant_id = $1
      `,
      [tenantId, cutoffDay, actorId]
    );
    return existingResult.rows[0].id;
  }

  const code = `${toSafeCode(organization.code || organization.name)}-MONTHLY`.slice(0, 50);
  const name = `${String(organization.name || "Organization").trim().slice(0, 90)} Monthly`;

  const result = await client.query(
    `
      INSERT INTO pay_groups (
        tenant_id,
        code,
        name,
        description,
        pay_frequency,
        cutoff_day,
        salary_pay_day,
        work_week_days,
        is_active,
        metadata,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,'monthly',$5,$6,6,true,$7::jsonb,$8,$8
      )
      RETURNING id
    `,
    [
      tenantId,
      code,
      name,
      "Auto-created from organization settings",
      cutoffDay,
      DEFAULT_SALARY_PAY_DAY,
      JSON.stringify({ autoProvisioned: true }),
      actorId
    ]
  );

  return result.rows[0]?.id || null;
};

const upsertPayrollSettings = async ({
  client,
  tenantId,
  defaultPayGroupId,
  orgSettings,
  actorId
}) => {
  await client.query(
    `
      INSERT INTO payroll_settings (
        tenant_id,
        default_pay_group_id,
        country_code,
        state_code,
        attendance_source,
        attendance_lock_mode,
        attendance_lock_after_days,
        rounding_policy,
        default_working_days,
        lop_calculation_method,
        enable_proration,
        enable_arrears,
        enable_reimbursements,
        enable_loan_deductions,
        metadata,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,'mongo_timesheet',$5,$6,'nearest_rupee',30,'working_days',
        true,true,true,true,$7::jsonb,$8,$8
      )
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        default_pay_group_id = COALESCE(payroll_settings.default_pay_group_id, EXCLUDED.default_pay_group_id),
        attendance_lock_mode = EXCLUDED.attendance_lock_mode,
        attendance_lock_after_days = EXCLUDED.attendance_lock_after_days,
        updated_by = EXCLUDED.updated_by,
        metadata = payroll_settings.metadata || EXCLUDED.metadata
    `,
    [
      tenantId,
      defaultPayGroupId,
      DEFAULT_COUNTRY_CODE,
      DEFAULT_STATE_CODE,
      String(orgSettings?.attendanceLockMode || "payroll_cutoff"),
      Number(orgSettings?.attendanceLockAfterDays ?? 7),
      JSON.stringify({
        autoProvisioned: true,
        orgSettingsCutoffDay: toDay(orgSettings?.payrollCutoffDay, 25)
      }),
      actorId
    ]
  );
};

exports.ensurePayrollTenantAndDefaults = async ({
  organizationId,
  actorId = "system",
  orgSettings = null,
  client: existingClient = null
}) => {
  const settings = await getOrgSettings(organizationId, orgSettings);
  if (!settings?.payrollEnabled) {
    throw {
      code: 400,
      message: "Payroll is disabled for this organization. Enable it in Organization Settings first."
    };
  }

  const organization = await getOrganization(organizationId);
  const pool = existingClient ? null : await ensurePool();
  const client = existingClient || (await pool.connect());

  try {
    const timezone = String(settings?.timezone || organization?.timezone || DEFAULT_TIMEZONE);
    const result = await client.query(
      `
        INSERT INTO payroll_tenants (
          organization_id,
          legal_name,
          trade_name,
          country_code,
          state_code,
          timezone,
          currency_code,
          is_active,
          metadata,
          created_by,
          updated_by
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,'INR',true,$7::jsonb,$8,$8
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
          legal_name = EXCLUDED.legal_name,
          trade_name = EXCLUDED.trade_name,
          state_code = EXCLUDED.state_code,
          timezone = EXCLUDED.timezone,
          is_active = true,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING id
      `,
      [
        String(organizationId),
        String(organization.name || "Organization"),
        String(organization.code || organization.name || "Organization"),
        DEFAULT_COUNTRY_CODE,
        DEFAULT_STATE_CODE,
        timezone,
        JSON.stringify({ autoProvisioned: true }),
        String(actorId || "system")
      ]
    );

    const tenantId = result.rows[0]?.id;
    const cutoffDay = toDay(settings?.payrollCutoffDay, 25);
    const defaultPayGroupId = await ensureDefaultPayGroup({
      client,
      tenantId,
      organization,
      cutoffDay,
      actorId: String(actorId || "system")
    });

    await upsertPayrollSettings({
      client,
      tenantId,
      defaultPayGroupId,
      orgSettings: settings,
      actorId: String(actorId || "system")
    });

    return { tenantId, defaultPayGroupId, payrollCutoffDay: cutoffDay };
  } finally {
    if (!existingClient && client) client.release();
  }
};

exports.getTenantIdForOrganization = async (
  client,
  organizationId,
  { actorId = "system", orgSettings = null, autoProvision = true, requirePayrollEnabled = true } = {}
) => {
  const settings = await getOrgSettings(organizationId, orgSettings);
  if (requirePayrollEnabled && !settings?.payrollEnabled) {
    throw {
      code: 400,
      message: "Payroll is disabled for this organization. Enable it in Organization Settings first."
    };
  }

  let tenantId = await queryTenantId(client, organizationId);
  if (!tenantId && autoProvision) {
    const provisioned = await exports.ensurePayrollTenantAndDefaults({
      organizationId,
      actorId,
      orgSettings: settings,
      client
    });
    tenantId = provisioned.tenantId;
  }

  if (!tenantId) {
    throw {
      code: 400,
      message:
        "Payroll tenant could not be resolved for this organization. Enable payroll in Organization Settings to provision it automatically."
    };
  }

  return tenantId;
};
