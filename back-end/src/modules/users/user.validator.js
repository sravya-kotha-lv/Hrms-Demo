const Joi = require("joi");

exports.registerUserSchema = Joi.object({
  organizationId: Joi.string().required(),

  email: Joi.string()
    .email()
    .required(),

  password: Joi.string()
    .min(6)
    .required(),

  roleIds: Joi.array()
    .items(Joi.string())
    .optional()
});

exports.loginUserSchema = Joi.object({
  email: Joi.string()
    .required(),

  password: Joi.string()
    .required()
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
