const test = require("node:test");
const assert = require("node:assert/strict");

const { __test__ } = require("../src/modules/payroll/payrollRun.service");

const {
  evaluateFormula,
  computeSlabAmount,
  resolveComponentAmount,
  roundAmount,
  normalizeComponentRows,
  isComponentEnabledForEmployee,
  applyEmployeeComponentOverride,
  computeAnnualTdsEstimate,
  computeTelanganaProfessionalTax,
  computeSalaryContextFromRules
} = __test__;

test("evaluateFormula supports math helpers and context variables", () => {
  const value = evaluateFormula("round((BASIC + HRA) * 0.1) + max(PT, 200)", {
    BASIC: 20000,
    HRA: 8000,
    PT: 150
  });

  assert.equal(value, 3000);
});

test("evaluateFormula rejects unknown variables", () => {
  assert.throws(() => evaluateFormula("BASIC + UNKNOWN_X", { BASIC: 1000 }), /Unknown variable/);
});

test("computeSlabAmount picks first matching slab", () => {
  const slabs = [
    { upto: 10000, rate: 5 },
    { upto: 20000, rate: 10 },
    { upto: null, amount: 2500 }
  ];

  assert.equal(computeSlabAmount(9000, slabs), 450);
  assert.equal(computeSlabAmount(18000, slabs), 1800);
  assert.equal(computeSlabAmount(30000, slabs), 2500);
});

test("resolveComponentAmount applies formula, proration and cap", () => {
  const component = {
    id: "cmp-earning-basic",
    calculation_mode: "fixed",
    cap_amount: 6000,
    rounding_policy: "nearest_rupee",
    prorate_with_attendance: true,
    metadata: {
      monthlyAmount: 10000,
      maxAmount: 7000
    }
  };

  const formulaMap = new Map([
    [
      "earning:cmp-earning-basic",
      [
        {
          formula_expression: "BASIC * 0.5",
          formula_variables: { BONUS_FACTOR: 1 }
        }
      ]
    ]
  ]);

  const amount = resolveComponentAmount({
    component,
    scope: "earning",
    formulaMap,
    context: { BASIC: 12000 },
    prorationFactor: 0.5,
    shouldProrateEarning: () => true
  });

  assert.equal(amount, 3000);
});

test("normalizeComponentRows merges duplicate component lines", () => {
  const merged = normalizeComponentRows([
    {
      component_scope: "earning",
      component_code: "BASIC",
      source_type: "salary_structure",
      amount: 1000,
      quantity: 1,
      taxable: true,
      affects_net_pay: true,
      metadata: {}
    },
    {
      component_scope: "earning",
      component_code: "BASIC",
      source_type: "salary_structure",
      amount: 500,
      quantity: 0.5,
      taxable: false,
      affects_net_pay: true,
      metadata: {}
    }
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].amount, roundAmount(1500, "exact"));
  assert.equal(merged[0].quantity, 1.5);
  assert.equal(merged[0].taxable, true);
  assert.equal(merged[0].affects_net_pay, true);
});

test("isComponentEnabledForEmployee respects pay group applicability and employee disable override", () => {
  const component = {
    code: "BONUS",
    metadata: {
      payGroupIds: ["pay-group-1"],
      defaultEnabled: false
    }
  };

  assert.equal(
    isComponentEnabledForEmployee({
      component,
      payGroupId: "pay-group-1",
      salary: {
        metadata: {
          salaryRules: {
            componentOverrides: {
              BONUS: { enabled: true }
            }
          }
        }
      }
    }),
    true
  );

  assert.equal(
    isComponentEnabledForEmployee({
      component,
      payGroupId: "pay-group-2",
      salary: { metadata: {} }
    }),
    false
  );
});

test("applyEmployeeComponentOverride merges employee-specific calculation metadata", () => {
  const component = {
    code: "BONUS",
    name: "Bonus",
    calculation_mode: "fixed",
    taxable: true,
    metadata: { monthlyAmount: 0 }
  };

  const overridden = applyEmployeeComponentOverride({
    component,
    salary: {
      metadata: {
        salaryRules: {
          componentOverrides: {
            BONUS: {
              name: "Quarterly Bonus",
              calculationMode: "percentage",
              amount: 20,
              base: "MONTHLY_GROSS",
              taxable: true
            }
          }
        }
      }
    }
  });

  assert.equal(overridden.name, "Quarterly Bonus");
  assert.equal(overridden.calculation_mode, "percentage");
  assert.equal(overridden.metadata.percentage, 20);
  assert.equal(overridden.metadata.base, "MONTHLY_GROSS");
});

test("computeTelanganaProfessionalTax uses Telangana monthly slabs", () => {
  assert.equal(computeTelanganaProfessionalTax(14000, true), 0);
  assert.equal(computeTelanganaProfessionalTax(18000, true), 150);
  assert.equal(computeTelanganaProfessionalTax(30000, true), 200);
});

test("computeAnnualTdsEstimate calculates monthly TDS for new regime with declarations", () => {
  const estimate = computeAnnualTdsEstimate({
    payMonth: "2026-04",
    projectedTaxableMonthlyIncome: 120000,
    statutory: {
      tax_regime: "new",
      metadata: {
        taxDeclaration: {
          previousEmployerTdsAnnual: 10000
        }
      }
    },
    salary: {},
    professionalTaxMonthly: 200
  });

  assert.equal(estimate.regime, "new");
  assert.ok(estimate.taxableIncome > 0);
  assert.ok(estimate.annualTaxLiability > 0);
  assert.equal(estimate.monthsRemaining, 12);
  assert.ok(estimate.monthlyTds > 0);
});

test("computeSalaryContextFromRules derives gross first and applies basic percent on gross", () => {
  const salaryContext = computeSalaryContextFromRules({
    salary: {
      annual_ctc: 1199999,
      monthly_gross: null,
      basic_pay: null,
      variable_pay: 9999.99,
      metadata: {
        salaryRules: {
          payGroupBasicPercent: 50,
          basicPercentSource: "pay_group",
          hraPercentOfBasic: 50,
          epfMode: "percentage",
          epfPercentOfBasic: 12,
          epfEmployerRate: 12,
          restrictPfWage: true,
          pfWageCeiling: 15000,
          includeEsi: true,
          esiEligibilityThreshold: 21000,
          esiEmployerRate: 3.25,
          esiEmployeeRate: 0.75
        }
      }
    }
  });

  assert.equal(salaryContext.monthlyGross, 98199.92);
  assert.equal(salaryContext.basicPay, 49099.96);
  assert.equal(salaryContext.employerEpf, 1800);
  assert.equal(salaryContext.effectiveBasicPercent, 50);
});
