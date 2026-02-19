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
const status = Joi.string().valid("active", "on_leave", "resigned");
const employmentLifecycleStatus = Joi.string().valid(
  "probation",
  "confirmed",
  "notice",
  "terminated"
);
const emergencyRelation = Joi.string().valid(
  "father",
  "mother",
  "spouse",
  "brother",
  "sister",
  "son",
  "daughter",
  "guardian",
  "friend",
  "other"
);
const emergencyName = Joi.string().trim().pattern(/^[A-Za-z ]{2,50}$/);
const emergencyPhone = Joi.string().trim().pattern(/^\d{10}$/);

/* ------------------------------------------------------------------ */
/* HR CREATES EMPLOYEE (MINIMUM REQUIRED DATA)                         */
/* ------------------------------------------------------------------ */
exports.createEmployeeByHrSchema = Joi.object({
  email: Joi.string().email().required(),
  roleIds: Joi.array().items(objectId).min(1).required(),

  firstName: Joi.string().trim().min(2).required(),
  lastName: Joi.string().trim().min(2).required(),

  employeeCode: Joi.string().trim().optional(),
  departmentId: objectId.required(),
  designationId: objectId.required(),

  dateOfJoining: Joi.date().required(),
  employmentType: employmentType.required(),
  managerId: objectId.optional(),
  shiftId: objectId.optional().allow(null, "")
});

/* ------------------------------------------------------------------ */
/* EMPLOYEE COMPLETES OWN PROFILE (FIRST LOGIN)                        */
/* ------------------------------------------------------------------ */
exports.completeProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).optional(),
  lastName: Joi.string().trim().min(2).optional(),
  departmentId: objectId.optional(),
  designationId: objectId.optional(),
  dateOfJoining: Joi.date().optional(),
  employmentType: employmentType.optional(),

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
      name: emergencyName.required(),
      relation: emergencyRelation.required(),
      phone: emergencyPhone.required()
    })
  ).optional(),
  profileImageUpload: Joi.object({
    fileName: Joi.string().required(),
    mimeType: Joi.string().required(),
    base64Data: Joi.string().required()
  }).optional(),
  addressProofUpload: Joi.object({
    fileName: Joi.string().required(),
    mimeType: Joi.string().required(),
    base64Data: Joi.string().required()
  }).optional()
});

/* ------------------------------------------------------------------ */
/* HR / ADMIN UPDATES EMPLOYEE                                         */
/* ------------------------------------------------------------------ */
exports.updateEmployeeSchema = Joi.object({
  email: Joi.string().email().optional(),
  roleIds: Joi.array().items(objectId).min(1).optional(),

  firstName: Joi.string().trim().min(2).optional(),
  lastName: Joi.string().trim().min(2).optional(),
  phone: Joi.string().optional(),

  employeeCode: Joi.string().trim().optional(),
  departmentId: objectId.optional(),
  designationId: objectId.optional(),
  dateOfJoining: Joi.date().optional(),
  employmentType: employmentType.optional(),
  status: status.optional(),
  employmentLifecycleStatus: employmentLifecycleStatus.optional(),
  managerId: objectId.optional(),
  shiftId: objectId.optional().allow(null, ""),

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
      name: emergencyName.required(),
      relation: emergencyRelation.required(),
      phone: emergencyPhone.required()
    })
  ).optional()
});

exports.lifecycleActionSchema = Joi.object({
  action: Joi.string()
    .valid("confirm", "terminate_with_notice", "terminate_without_notice")
    .required(),
  reason: Joi.string().trim().max(300).optional().allow("")
});

exports.listEmployeesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().trim().optional().allow(""),
  departmentId: objectId.optional(),
  designationId: objectId.optional(),
  status: status.optional(),
  managerId: objectId.optional(),
  employmentType: employmentType.optional(),
  organizationId: objectId.optional(),
  sortBy: Joi.string()
    .valid(
      "createdAt",
      "firstName",
      "lastName",
      "employeeCode",
      "dateOfJoining",
      "status",
      "employmentLifecycleStatus"
    )
    .optional(),
  sortOrder: Joi.string().lowercase().valid("asc", "desc").optional()
});

exports.bulkUpdateEmployeesSchema = Joi.object({
  employeeIds: Joi.array().items(objectId).min(1).required(),
  shiftId: objectId.optional().allow(null, ""),
  managerId: objectId.optional().allow(null, ""),
  departmentId: objectId.optional(),
  designationId: objectId.optional(),
  status: status.optional(),
  employmentLifecycleStatus: employmentLifecycleStatus.optional()
}).or(
  "shiftId",
  "managerId",
  "departmentId",
  "designationId",
  "status",
  "employmentLifecycleStatus"
);
