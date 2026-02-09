const Joi = require("joi");

exports.upsertOrgSettingsSchema = Joi.object({
  leaveCreditFrequency: Joi.string().valid("monthly", "quarterly", "yearly").required(),
  minWorkHoursPerDay: Joi.number().min(0).max(24).required(),
  minHalfDayHours: Joi.number().min(0).max(24).max(Joi.ref("minWorkHoursPerDay")).required()
});
