const test = require("node:test");
const assert = require("node:assert/strict");

const { __test__ } = require("../src/modules/payroll/payrollRun.service");

const {
  evaluateFormula,
  computeSlabAmount,
  resolveComponentAmount,
  roundAmount,
  normalizeComponentRows
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
