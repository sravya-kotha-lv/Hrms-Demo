const Joi = require("joi");

const createLeaveTypeSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().max(5).required(),
  description: Joi.string().allow(""),
  daysPerYear: Joi.number().min(0).required(),
  isCarryForward: Joi.boolean().default(false),
  maxCarryForward: Joi.number().min(0).allow(null),
  status: Joi.string().optional().valid("active", "inactive").default("active")
});

const updateLeaveTypeSchema = Joi.object({
  name: Joi.string(),
  code: Joi.string().max(5),
  description: Joi.string().allow(""),
  daysPerYear: Joi.number().min(0),
  isCarryForward: Joi.boolean(),
  maxCarryForward: Joi.number().min(0).allow(null),
  status: Joi.string().valid("active", "inactive")
});

module.exports = { createLeaveTypeSchema, updateLeaveTypeSchema };
