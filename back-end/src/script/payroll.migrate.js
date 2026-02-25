require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPayrollPgPool, validatePayrollDbConfig } = require("../config/payrollDb");

const MIGRATIONS_DIR = path.join(__dirname, "..", "payroll", "migrations");
const rawMigrationTable = process.env.PAYROLL_MIGRATIONS_TABLE || "payroll_schema_migrations";
const MIGRATION_TABLE = String(rawMigrationTable).trim();
const MIGRATION_LOCK_KEY = Number(process.env.PAYROLL_MIGRATION_LOCK_KEY || 9011001);

const command = (process.argv[2] || "").toLowerCase();
const stepsArg = process.argv.find((arg) => arg.startsWith("--steps="));
const downSteps = stepsArg ? Number(stepsArg.split("=")[1]) : 1;

if (!process.env.PAYROLL_DB_ENABLED) {
  process.env.PAYROLL_DB_ENABLED = "true";
}

const assertValidCommand = () => {
  if (!["up", "down", "status"].includes(command)) {
    throw new Error("Invalid command. Use: up | down | status");
  }
};

const assertMigrationsDirExists = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
};

const assertSafeIdentifiers = () => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(MIGRATION_TABLE)) {
    throw new Error(
      "PAYROLL_MIGRATIONS_TABLE must be a valid SQL identifier (letters, numbers, underscore)"
    );
  }
};

const getMigrationChecksum = (migrationPath) => {
  const fileBuffer = fs.readFileSync(migrationPath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
};

const loadMigrations = () => {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".js"))
    .sort();

  const migrations = files.map((file) => {
    const migrationPath = path.join(MIGRATIONS_DIR, file);
    const migration = require(migrationPath);
    const checksum = getMigrationChecksum(migrationPath);

    if (!migration?.id || !migration?.name) {
      throw new Error(`Migration ${file} must export id and name`);
    }
    if (!Array.isArray(migration.up) || migration.up.length === 0) {
      throw new Error(`Migration ${file} must include non-empty up[]`);
    }
    if (!Array.isArray(migration.down) || migration.down.length === 0) {
      throw new Error(`Migration ${file} must include non-empty down[]`);
    }

    return {
      id: String(migration.id),
      name: String(migration.name),
      up: migration.up,
      down: migration.down,
      checksum
    };
  });

  const duplicateIds = migrations.filter(
    (item, idx) => migrations.findIndex((m) => m.id === item.id) !== idx
  );
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate migration ids found: ${duplicateIds.map((d) => d.id).join(", ")}`);
  }

  return migrations;
};

const ensureMigrationTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id BIGSERIAL PRIMARY KEY,
      migration_id VARCHAR(64) NOT NULL UNIQUE,
      migration_name VARCHAR(255) NOT NULL,
      checksum VARCHAR(128) NOT NULL,
      execution_ms INTEGER NOT NULL DEFAULT 0,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_by VARCHAR(128) NOT NULL DEFAULT CURRENT_USER
    );
  `);
};

const getAppliedMigrations = async (client) => {
  const result = await client.query(
    `SELECT migration_id, migration_name, checksum, applied_at FROM ${MIGRATION_TABLE} ORDER BY migration_id ASC`
  );
  return result.rows;
};

const runStatements = async (client, statements) => {
  for (const sql of statements) {
    await client.query(sql);
  }
};

const withAdvisoryLock = async (client, callback) => {
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  try {
    return await callback();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  }
};

const migrateUp = async (client, migrations) => {
  const appliedRows = await getAppliedMigrations(client);
  const appliedMap = new Map(appliedRows.map((row) => [row.migration_id, row]));
  const pending = migrations.filter((migration) => !appliedMap.has(migration.id));

  if (pending.length === 0) {
    console.log("ℹ No pending payroll migrations");
    return;
  }

  for (const migration of pending) {
    const startedAt = Date.now();
    await client.query("BEGIN");
    try {
      await runStatements(client, migration.up);
      const executionMs = Date.now() - startedAt;
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (migration_id, migration_name, checksum, execution_ms) VALUES ($1, $2, $3, $4)`,
        [migration.id, migration.name, migration.checksum, executionMs]
      );
      await client.query("COMMIT");
      console.log(`✅ Applied migration ${migration.id} - ${migration.name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(
        `Failed migration ${migration.id} - ${migration.name}: ${error?.message || error}`
      );
    }
  }
};

const migrateDown = async (client, migrations, steps) => {
  const appliedRows = await getAppliedMigrations(client);
  if (appliedRows.length === 0) {
    console.log("ℹ No applied payroll migrations to roll back");
    return;
  }

  const byId = new Map(migrations.map((migration) => [migration.id, migration]));
  const rollbackRows = [...appliedRows].sort((a, b) =>
    String(b.migration_id).localeCompare(String(a.migration_id))
  ).slice(0, steps);

  for (const row of rollbackRows) {
    const migration = byId.get(row.migration_id);
    if (!migration) {
      throw new Error(
        `Cannot rollback migration ${row.migration_id}; file missing in ${MIGRATIONS_DIR}`
      );
    }

    await client.query("BEGIN");
    try {
      await runStatements(client, migration.down);
      await client.query(`DELETE FROM ${MIGRATION_TABLE} WHERE migration_id = $1`, [
        row.migration_id
      ]);
      await client.query("COMMIT");
      console.log(`↩ Rolled back migration ${migration.id} - ${migration.name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(
        `Failed rollback ${migration.id} - ${migration.name}: ${error?.message || error}`
      );
    }
  }
};

const printStatus = async (client, migrations) => {
  const appliedRows = await getAppliedMigrations(client);
  const appliedMap = new Map(appliedRows.map((row) => [row.migration_id, row]));

  console.log("Payroll migration status:");
  for (const migration of migrations) {
    const row = appliedMap.get(migration.id);
    if (row) {
      console.log(
        `  [APPLIED] ${migration.id} ${migration.name} at ${new Date(row.applied_at).toISOString()}`
      );
    } else {
      console.log(`  [PENDING] ${migration.id} ${migration.name}`);
    }
  }
};

(async () => {
  let client;
  try {
    assertValidCommand();
    assertMigrationsDirExists();
    assertSafeIdentifiers();
    validatePayrollDbConfig();

    const migrations = loadMigrations();
    const pool = await getPayrollPgPool();
    if (!pool) {
      throw new Error("Payroll Postgres pool unavailable");
    }

    client = await pool.connect();
    await ensureMigrationTable(client);

    await withAdvisoryLock(client, async () => {
      if (command === "up") {
        await migrateUp(client, migrations);
        return;
      }

      if (command === "down") {
        if (!Number.isInteger(downSteps) || downSteps <= 0) {
          throw new Error("--steps must be a positive integer");
        }
        await migrateDown(client, migrations, downSteps);
        return;
      }

      await printStatus(client, migrations);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Payroll migration command failed:", error?.message || error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
  }
})();
