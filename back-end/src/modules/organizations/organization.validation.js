const Joi = require("joi");

exports.createOrganizationSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().required(),
  timezone: Joi.string().required(),
  currency: Joi.string().required(),
  adminUserId: Joi.string().required(),
  adminRoleId: Joi.string().optional()
});

exports.updateOrganizationSchema = Joi.object({
  name: Joi.string().optional(),
  timezone: Joi.string().optional(),
  currency: Joi.string().optional(),
  status: Joi.string().valid("active", "inactive").optional()
});
