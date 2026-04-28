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

test("createEmployeeProfile does not require salary effectiveFrom", async () => {
  const restores = [];
  const servicePath = require.resolve("../src/modules/payroll/payrollApi.service");
  const queryOrder = [];
  let insertParams = null;

  const client = {
    async query(sql, params = []) {
      if (sql === "BEGIN" || sql === "COMMIT") {
        queryOrder.push(sql);
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO employee_payroll_profiles")) {
        queryOrder.push("INSERT_PROFILE");
        insertParams = params;
        return {
          rows: [
            {
              id: "profile-1",
              employee_external_id: params[1],
              date_of_joining: params[7]
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
  restores.push(mockModule("../src/modules/employees/employee.model", {}));

  delete require.cache[servicePath];
  const service = require("../src/modules/payroll/payrollApi.service");

  try {
    const result = await service.createEmployeeProfile({
      user: { organizationId: "org-1", userId: "user-1" },
      body: {
        employeeExternalId: "69e5cbefe8f982364560542a",
        employeeCode: "PV-0034",
        payGroupId: "cf4bebd2-6dcc-4701-8d1c-c207b9d71de1",
        payrollStatus: "active",
        defaultPaymentMode: "bank_transfer",
        taxRegime: "new",
        dateOfJoining: "2026-04-20"
      }
    });

    assert.equal(result.id, "profile-1");
    assert.deepEqual(queryOrder, ["BEGIN", "INSERT_PROFILE", "COMMIT"]);
    assert.equal(insertParams[7], "2026-04-20");
  } finally {
    delete require.cache[servicePath];
    for (const restore of restores.reverse()) restore();
  }
});
