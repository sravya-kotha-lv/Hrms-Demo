const Joi = require("joi");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

exports.switchOrgSchema = Joi.object({
  organizationId: Joi.string().required()
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

exports.createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  roleIds: Joi.array().items(Joi.string()).min(1).required(),

  firstName: Joi.string().trim().min(2).required(),
  lastName: Joi.string().trim().min(2).required(),
  departmentId: objectId.optional().allow(null,""),
  designationId: objectId.optional().allow(null,""),
  employmentType: Joi.string().valid("full_time", "part_time", "contract").required(),
  dateOfJoining: Joi.date().required(),
  managerId: objectId.optional().allow(null,""),
  shiftId: objectId.optional().allow(null,"")
});

exports.switchOrgSchema = Joi.object({
  organizationId: Joi.string().required(),
  // roleId: Joi.string().optional()
});

exports.sendOTPUserSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
});

exports.validateOTPSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),

  otp: Joi.string()
    .length(6)
    .required()
});

exports.resetPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),
  password: Joi.string()
    .min(6)
    .required(),
  confirmPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Confirm password must match password"
    })
});

exports.verifyOtpOnlySchema = Joi.object({
  otp: Joi.string()
    .length(6)
    .required()
});

exports.updatePasswordAuthSchema = Joi.object({
  password: Joi.string()
    .min(6)
    .required(),
  confirmPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Confirm password must match password"
    })
});
