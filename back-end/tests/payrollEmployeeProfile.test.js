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

test("createSalaryStructure starts transaction before writing salary package", async () => {
  const restores = [];
  const servicePath = require.resolve("../src/modules/payroll/payrollApi.service");
  const queryOrder = [];

  const client = {
    async query(sql, params = []) {
      if (sql === "BEGIN" || sql === "COMMIT") {
        queryOrder.push(sql);
        return { rows: [] };
      }

      if (sql.includes("SELECT id") && sql.includes("effective_from = $3::date")) {
        queryOrder.push("CHECK_EFFECTIVE_DATE");
        return { rows: [] };
      }

      if (sql.includes("SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version")) {
        queryOrder.push("NEXT_VERSION");
        return { rows: [{ next_version: 1 }] };
      }

      if (sql.includes("UPDATE employee_salary_structures")) {
        queryOrder.push("CLEAR_CURRENT");
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO employee_salary_structures")) {
        queryOrder.push("INSERT_SALARY");
        return {
          rows: [
            {
              id: "salary-1",
              employee_payroll_profile_id: params[1],
              annual_ctc: params[4]
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
    const result = await service.createSalaryStructure({
      user: { organizationId: "org-1", userId: "user-1" },
      params: { profileId: "profile-1" },
      body: {
        structureCode: "SAL-20260514",
        structureName: "Standard Structure",
        annualCtc: 1200000,
        monthlyGross: 95000,
        basicPay: 47500,
        variablePay: 0,
        isCurrent: true,
        effectiveFrom: "2026-05-14",
        metadata: {
          salaryRules: {
            componentOverrides: {
              BONUS: { enabled: false }
            }
          }
        }
      }
    });

    assert.equal(result.id, "salary-1");
    assert.deepEqual(queryOrder, [
      "BEGIN",
      "CHECK_EFFECTIVE_DATE",
      "NEXT_VERSION",
      "CLEAR_CURRENT",
      "INSERT_SALARY",
      "COMMIT"
    ]);
  } finally {
    delete require.cache[servicePath];
    for (const restore of restores.reverse()) restore();
  }
});

test("createSalaryStructure rejects duplicate effective date to preserve revision history", async () => {
  const restores = [];
  const servicePath = require.resolve("../src/modules/payroll/payrollApi.service");
  let rolledBack = false;

  const client = {
    async query(sql) {
      if (sql === "BEGIN") return { rows: [] };

      if (sql.includes("SELECT id") && sql.includes("effective_from = $3::date")) {
        return { rows: [{ id: "salary-existing" }] };
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
      safeRollback: async () => {
        rolledBack = true;
      }
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
    await assert.rejects(
      () =>
        service.createSalaryStructure({
          user: { organizationId: "org-1", userId: "user-1" },
          params: { profileId: "profile-1" },
          body: {
            structureCode: "SAL-20260514",
            structureName: "Hike Structure",
            annualCtc: 1400000,
            effectiveFrom: "2026-05-14"
          }
        }),
      (error) => {
        assert.equal(error.code, 409);
        assert.match(error.message, /salary revision already exists/);
        return true;
      }
    );
    assert.equal(rolledBack, true);
  } finally {
    delete require.cache[servicePath];
    for (const restore of restores.reverse()) restore();
  }
});

test("updateSalaryStructure is scoped to payroll tenant", async () => {
  const restores = [];
  const servicePath = require.resolve("../src/modules/payroll/payrollApi.service");
  let updateParams = null;

  const client = {
    async query(sql, params = []) {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("SELECT employee_payroll_profile_id, effective_from, effective_to")) {
        return {
          rows: [
            {
              employee_payroll_profile_id: "profile-1",
              effective_from: "2026-05-14",
              effective_to: null
            }
          ]
        };
      }

      if (sql.includes("AND effective_from > $4::date")) {
        return { rows: [] };
      }

      if (sql.includes("UPDATE employee_salary_structures")) {
        updateParams = params;
        assert.match(sql, /AND tenant_id = \$12/);
        return {
          rows: [
            {
              id: params[0],
              annual_ctc: params[2],
              tenant_id: params[11]
            }
          ]
        };
      }

      if (sql.includes("AND effective_from > $4::date")) {
        return { rows: [{ id: "salary-newer" }] };
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
    const result = await service.updateSalaryStructure({
      user: { organizationId: "org-1", userId: "user-1" },
      params: { salaryStructureId: "salary-1" },
      body: {
        annualCtc: 1300000,
        metadata: {
          salaryRules: {
            basicPercentSource: "employee"
          }
        }
      }
    });

    assert.equal(result.tenant_id, "tenant-1");
    assert.equal(updateParams[11], "tenant-1");
  } finally {
    delete require.cache[servicePath];
    for (const restore of restores.reverse()) restore();
  }
});

test("updateSalaryStructure rejects closed historical revision updates", async () => {
  const restores = [];
  const servicePath = require.resolve("../src/modules/payroll/payrollApi.service");
  let rolledBack = false;

  const client = {
    async query(sql) {
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "ROLLBACK") {
        rolledBack = true;
        return { rows: [] };
      }

      if (sql.includes("SELECT employee_payroll_profile_id, effective_from, effective_to")) {
        return {
          rows: [
            {
              employee_payroll_profile_id: "profile-1",
              effective_from: "2026-05-14",
              effective_to: "2026-07-30"
            }
          ]
        };
      }

      if (sql.includes("AND effective_from > $4::date")) {
        return { rows: [{ id: "salary-newer" }] };
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
    await assert.rejects(
      () =>
        service.updateSalaryStructure({
          user: { organizationId: "org-1", userId: "user-1" },
          params: { salaryStructureId: "salary-old" },
          body: { annualCtc: 1200000 }
        }),
      (error) => {
        assert.equal(error.code, 409);
        assert.match(error.message, /Can't switch to older revision/);
        return true;
      }
    );
    assert.equal(rolledBack, true);
  } finally {
    delete require.cache[servicePath];
    for (const restore of restores.reverse()) restore();
  }
});
