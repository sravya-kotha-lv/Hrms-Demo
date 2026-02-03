const Joi = require("joi");

exports.createHolidaySchema = Joi.object({
  name: Joi.string().min(3).required(),
  date: Joi.date().required(),
  status: Joi.string().valid("active", "inactive").default("active")
});

exports.updateHolidaySchema = Joi.object({
  name: Joi.string().min(3).optional(),
  date: Joi.date().optional(),
  status: Joi.string().valid("active", "inactive").optional()
});
