const test = require("node:test");
const assert = require("node:assert/strict");

const {
  completeProfileSchema,
  updateEmployeeSchema
} = require("../src/modules/employees/employee.validation");

const validCompleteProfilePayload = {
  phone: "9876543210",
  dob: "1998-01-20",
  gender: "Male",
  aadhaarNumber: "123456789012",
  panNumber: "ABCDE1234F",
  address: {
    line1: "Street 1",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    zip: "500081"
  }
};

test("completeProfileSchema accepts numeric zip", () => {
  const { error } = completeProfileSchema.validate(validCompleteProfilePayload);
  assert.equal(error, undefined);
});

test("completeProfileSchema rejects alphabetic zip", () => {
  const { error } = completeProfileSchema.validate({
    ...validCompleteProfilePayload,
    address: {
      ...validCompleteProfilePayload.address,
      zip: "ABC123"
    }
  });
  assert.ok(error);
});

test("updateEmployeeSchema rejects alphabetic zip", () => {
  const { error } = updateEmployeeSchema.validate({
    address: {
      zip: "ABCDE"
    }
  });
  assert.ok(error);
});
