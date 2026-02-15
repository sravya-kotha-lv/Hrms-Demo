const Joi = require("joi");

const entrySchema = Joi.object({
  date: Joi.date().required(),
  hours: Joi.number().min(0).max(24).required(),
  notes: Joi.string().allow("").max(500).optional()
});

exports.createWeeklySchema = Joi.object({
  weekStart: Joi.date().optional(),
  entries: Joi.array().items(entrySchema).optional()
});

exports.updateWeeklySchema = Joi.object({
  entries: Joi.array().items(entrySchema).required(),
  weekStart: Joi.date().optional()
});

exports.submitWeeklySchema = Joi.object({
  weekStart: Joi.date().optional(),
  entries: Joi.array().items(entrySchema).optional()
});

exports.actionWeeklySchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  rejectionReason: Joi.when("status", {
    is: "rejected",
    then: Joi.string().min(3).required(),
    otherwise: Joi.optional()
  })
});

exports.overrideAttendanceSchema = Joi.object({
  date: Joi.date().required(),
  status: Joi.string().valid("present", "absent").required()
});
