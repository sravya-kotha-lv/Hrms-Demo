const Joi = require("joi");

exports.createOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  code: Joi.string().trim().uppercase().required(),
  timezone: Joi.string().required(),
  currency: Joi.string().length(3).uppercase().required(),
  status: Joi.string().valid("active", "inactive").required()
});

exports.updateOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  timezone: Joi.string().required(),
  currency: Joi.string().length(3).uppercase().required(),
  status: Joi.string().valid("active", "inactive").required()
});
