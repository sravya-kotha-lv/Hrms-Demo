const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
});

const phone = Joi.string().pattern(/^[0-9+\-() ]{7,20}$/);

const employmentType = Joi.string().valid(
  "full_time",
  "part_time",
  "contract"
);

/**
 * CREATE EMPLOYEE
 */
exports.createEmployeeSchema = Joi.object({
  userId: objectId.required(),

  firstName: Joi.string().trim().min(2).required(),
  lastName: Joi.string().trim().min(2).required(),

  phone: phone.required(),

  employeeCode: Joi.string().trim().required(),

  departmentId: objectId.required(),

  designationId: objectId.required(), // ✅ FIXED

  dateOfJoining: Joi.date().required(),

  employmentType: employmentType.required(),

  managerId: objectId.optional().allow(null),

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
      phone: phone.required()
    })
  ).optional()
});

/**
 * UPDATE EMPLOYEE
 */
exports.updateEmployeeSchema = Joi.object({
  firstName: Joi.string().trim().min(2).optional(),
  lastName: Joi.string().trim().min(2).optional(),

  phone: phone.optional(),

  departmentId: objectId.optional(),

  designationId: objectId.optional(), // ✅ FIXED

  employmentType: employmentType.optional(),

  managerId: objectId.optional().allow(null),

  dob: Joi.date().optional(),
  gender: Joi.string().optional(),

  status: Joi.string()
    .valid("active", "on_leave", "resigned")
    .optional(),

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
      phone: phone.required()
    })
  ).optional()
});
