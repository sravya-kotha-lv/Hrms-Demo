require("dotenv").config();

const {
  getPayrollPgPool,
  validatePayrollDbConfig
} = require("../config/payrollDb");

if (!process.env.PAYROLL_DB_ENABLED) {
  process.env.PAYROLL_DB_ENABLED = "true";
}

const args = new Set(process.argv.slice(2));
const getArgValue = (name) => {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

const modeArg = getArgValue("--mode");
const mode = args.has("--all") ? "all" : args.has("--generated") ? "generated" : modeArg || "generated";
const includeTenants = args.has("--include-tenants");
const confirmed = args.has("--yes") || args.has("-y");

const GENERATED_TABLES = [
  "payroll_action_idempotency",
  "payroll_run_audit_entries",
  "payroll_run_components",
  "payroll_run_employees",
  "payroll_runs",
  "payroll_adjustments",
  "payroll_arrears",
  "payroll_loans",
  "payroll_reimbursements",
  "payroll_attendance_snapshot_days",
  "payroll_attendance_snapshots"
];

const SETUP_TABLES = [
  "employee_payroll_revision_history",
  "employee_bank_details",
  "employee_statutory_details",
  "employee_salary_structures",
  "employee_payroll_profiles",
  "component_formulas",
  "earning_components",
  "deduction_components",
  "employer_contribution_components",
  "payroll_settings",
  "pay_periods",
  "pay_groups"
];

const printUsage = () => {
  console.log(`
Usage:
  npm run clear:payroll:data -- --yes
  npm run clear:payroll:data -- --all --yes
  npm run clear:payroll:data -- --all --include-tenants --yes

Modes:
  generated       Clears payroll runs, run rows, attendance snapshots, approvals, idempotency,
                  adjustments, arrears, loans, and reimbursements. Keeps pay groups, components,
                  employee payroll profiles, salary, bank, statutory setup, tenants, and migrations.

  all             Clears generated data plus payroll setup data. Keeps payroll tenants and
                  migration history unless --include-tenants is also passed.

Safety:
  --yes / -y      Required. This command deletes payroll Postgres rows.
`);
};

const assertValidOptions = () => {
  if (args.has("--help") || args.has("-h")) {
    printUsage();
    process.exit(0);
  }

  if (!["generated", "all"].includes(mode)) {
    throw new Error("Invalid payroll clear mode. Use --generated, --all, or --mode=generated|all.");
  }

  if (includeTenants && mode !== "all") {
    throw new Error("--include-tenants can only be used with --all.");
  }

  if (!confirmed) {
    printUsage();
    throw new Error("Refusing to clear payroll data without --yes.");
  }
};

const quoteIdent = (value) => `"${String(value).replace(/"/g, "\"\"")}"`;

const getExistingTables = async (client, tableNames) => {
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [tableNames]
  );

  return new Set(result.rows.map((row) => row.table_name));
};

const buildTableList = () => {
  const tables = mode === "all"
    ? [...GENERATED_TABLES, ...SETUP_TABLES]
    : GENERATED_TABLES;

  if (includeTenants) {
    tables.push("payroll_tenants");
  }

  return [...new Set(tables)];
};

(async () => {
  let client;
  try {
    assertValidOptions();
    validatePayrollDbConfig();

    const pool = await getPayrollPgPool();
    if (!pool) {
      throw new Error("Payroll Postgres pool unavailable");
    }

    client = await pool.connect();
    const requestedTables = buildTableList();
    const existingTables = await getExistingTables(client, requestedTables);
    const tablesToClear = requestedTables.filter((table) => existingTables.has(table));

    if (!tablesToClear.length) {
      console.log("ℹ No payroll tables found to clear.");
      process.exit(0);
    }

    await client.query("BEGIN");
    await client.query(
      `TRUNCATE TABLE ${tablesToClear.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`
    );
    await client.query("COMMIT");

    console.log(`✅ Cleared payroll ${mode} data from ${tablesToClear.length} table(s).`);
    if (includeTenants) {
      console.log("ℹ Payroll tenants were also cleared. Run `npm run seed:payroll:tenants` before using payroll.");
    } else if (mode === "all") {
      console.log("ℹ Payroll tenants and migration history were kept. Recreate pay groups/components before creating runs.");
    } else {
      console.log("ℹ Payroll setup was kept. You can now regenerate/import attendance snapshots and create fresh runs.");
    }

    process.exit(0);
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // Ignore rollback errors when no transaction is active.
      }
    }
    console.error("❌ Payroll clear command failed:", error?.message || error);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
})();
