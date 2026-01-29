const Joi = require("joi");

exports.createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  roleIds: Joi.array().items(Joi.string()).required()
});

exports.switchOrgSchema = Joi.object({
  organizationId: Joi.string().required()
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

exports.createUserSchema = Joi.object({
  email: Joi.string()
    .email()
    .required(),

  password: Joi.string()
    .min(6)
    .required(),

  roleIds: Joi.array()
    .items(Joi.string())
    .min(1)
    .required()
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
