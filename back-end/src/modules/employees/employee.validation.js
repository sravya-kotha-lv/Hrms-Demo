const Joi = require("joi");
const mongoose = require("mongoose");

/* ----------------------------- helpers ----------------------------- */

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
});

const employmentType = Joi.string().valid(
  "full_time",
  "part_time",
  "contract"
);

/* ------------------------------------------------------------------ */
/* HR CREATES EMPLOYEE (MINIMUM REQUIRED DATA)                         */
/* ------------------------------------------------------------------ */
exports.createEmployeeByHrSchema = Joi.object({
  email: Joi.string().email().required(),
  roleIds: Joi.array().items(objectId).min(1).required(),

  firstName: Joi.string().trim().min(2).required(),
  lastName: Joi.string().trim().min(2).required(),

  employeeCode: Joi.string().trim().required(),
  departmentId: objectId.required(),
  designationId: objectId.required(),

  dateOfJoining: Joi.date().required(),
  employmentType: employmentType.required()
});

/* ------------------------------------------------------------------ */
/* EMPLOYEE COMPLETES OWN PROFILE (FIRST LOGIN)                        */
/* ------------------------------------------------------------------ */
exports.completeProfileSchema = Joi.object({
  phone: Joi.string().optional(),
  dob: Joi.date().optional(),
  gender: Joi.string().optional(),

  address: Joi.object({
    line1: Joi.string().optional(),
    line2: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    zip: Joi.string().optional()
  }).optional(),

  emergencyContacts: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      relation: Joi.string().required(),
      phone: Joi.string().required()
    })
  ).optional()
});
