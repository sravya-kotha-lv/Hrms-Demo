const test = require("node:test");
const assert = require("node:assert/strict");

const mockModule = (modulePath, exportsValue) => {
  const resolved = require.resolve(modulePath);
  const original = require.cache[resolved];
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue
  };

  return () => {
    if (original) require.cache[resolved] = original;
    else delete require.cache[resolved];
  };
};

test("createSalaryComponent reuses starter component for setup wizard duplicate", async () => {
  const restores = [];
  const servicePath = require.resolve("../src/modules/payroll/payrollApi.service");

  const client = {
    async query(sql, params = []) {
      if (sql.includes("INSERT INTO earning_components")) {
        const error = new Error("duplicate key");
        error.code = "23505";
        error.constraint = "uq_earning_component_version";
        throw error;
      }

      if (sql.includes("FROM earning_components")) {
        return {
          rows: [
            {
              id: "cmp-basic-1",
              tenant_id: params[0],
              code: params[1],
              name: "Basic Pay",
              metadata: { autoProvisioned: true, starterPack: true }
            }
          ]
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {}
  };

  restores.push(
    mockModule("../src/config/payrollDb", {
      getPayrollPgPool: async () => ({
        connect: async () => client
      })
    })
  );
  restores.push(
    mockModule("../src/modules/payroll/payrollProvisioning.service", {
      getTenantIdForOrganization: async () => "tenant-1"
    })
  );
  restores.push(
    mockModule("../src/modules/payroll/payrollTx", {
      safeRollback: async () => {}
    })
  );
  restores.push(
    mockModule("../src/modules/orgSettings/orgSettings.model", {
      findOne: () => ({ select: () => ({ lean: async () => null }) })
    })
  );
  restores.push(
    mockModule("../src/modules/employees/employee.model", {})
  );

  delete require.cache[servicePath];
  const service = require("../src/modules/payroll/payrollApi.service");

  try {
    const result = await service.createSalaryComponent({
      user: { organizationId: "org-1", userId: "user-1" },
      body: {
        scope: "earning",
        code: "BASIC",
        name: "Basic",
        calculationMode: "formula",
        effectiveFrom: "2026-04-22",
        metadata: {
          wizardVersion: "v1",
          expression: "BASIC_PAY"
        }
      }
    });

    assert.equal(result.id, "cmp-basic-1");
    assert.equal(result.code, "BASIC");
  } finally {
    delete require.cache[servicePath];
    for (const restore of restores.reverse()) restore();
  }
});

test("createSalaryComponent still throws duplicate for non-wizard request", async () => {
  const restores = [];
  const servicePath = require.resolve("../src/modules/payroll/payrollApi.service");

  const duplicateError = new Error("duplicate key");
  duplicateError.code = "23505";
  duplicateError.constraint = "uq_earning_component_version";

  const client = {
    async query(sql) {
      if (sql.includes("INSERT INTO earning_components")) {
        throw duplicateError;
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {}
  };

  restores.push(
    mockModule("../src/config/payrollDb", {
      getPayrollPgPool: async () => ({
        connect: async () => client
      })
    })
  );
  restores.push(
    mockModule("../src/modules/payroll/payrollProvisioning.service", {
      getTenantIdForOrganization: async () => "tenant-1"
    })
  );
  restores.push(
    mockModule("../src/modules/payroll/payrollTx", {
      safeRollback: async () => {}
    })
  );
  restores.push(
    mockModule("../src/modules/orgSettings/orgSettings.model", {
      findOne: () => ({ select: () => ({ lean: async () => null }) })
    })
  );
  restores.push(
    mockModule("../src/modules/employees/employee.model", {})
  );

  delete require.cache[servicePath];
  const service = require("../src/modules/payroll/payrollApi.service");

  try {
    await assert.rejects(
      () =>
        service.createSalaryComponent({
          user: { organizationId: "org-1", userId: "user-1" },
          body: {
            scope: "earning",
            code: "BASIC",
            name: "Basic",
            calculationMode: "formula",
            effectiveFrom: "2026-04-22",
            metadata: {
              expression: "BASIC_PAY"
            }
          }
        }),
      duplicateError
    );
  } finally {
    delete require.cache[servicePath];
    for (const restore of restores.reverse()) restore();
  }
});
