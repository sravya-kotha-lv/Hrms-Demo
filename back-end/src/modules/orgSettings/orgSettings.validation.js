const Joi = require("joi");

exports.upsertOrgSettingsSchema = Joi.object({
  leaveCreditFrequency: Joi.string().valid("monthly", "quarterly", "yearly").required()
});
