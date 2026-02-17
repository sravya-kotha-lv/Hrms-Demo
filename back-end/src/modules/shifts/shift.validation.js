const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
});

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

exports.createShiftSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  code: Joi.string().trim().min(2).max(20).required(),
  startTime: Joi.string().pattern(timeRegex).required(),
  endTime: Joi.string().pattern(timeRegex).required(),
  graceMinutes: Joi.number().integer().min(0).max(180).default(0),
  status: Joi.string().valid("active", "inactive").default("active")
});

exports.updateShiftSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).optional(),
  code: Joi.string().trim().min(2).max(20).optional(),
  startTime: Joi.string().pattern(timeRegex).optional(),
  endTime: Joi.string().pattern(timeRegex).optional(),
  graceMinutes: Joi.number().integer().min(0).max(180).optional(),
  status: Joi.string().valid("active", "inactive").optional()
});

exports.shiftIdParamSchema = Joi.object({
  id: objectId.required()
});

