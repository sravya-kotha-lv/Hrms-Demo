const Joi = require("joi");

exports.createDesignationSchema = Joi.object({
  name: Joi.string().min(2).required(),
  level: Joi.number().optional(),
  departmentId: Joi.string().required(),
  status: Joi.string().valid("active", "inactive").default("active")
});

exports.updateDesignationSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  level: Joi.number().optional(),
  departmentId: Joi.string().required(),
  status: Joi.string().valid("active", "inactive").optional()
});
