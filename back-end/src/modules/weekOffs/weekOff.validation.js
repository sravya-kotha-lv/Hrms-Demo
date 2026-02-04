const Joi = require("joi");

exports.upsertWeekOffSchema = Joi.object({
  weekOffDays: Joi.array()
    .items(Joi.number().integer().min(0).max(6))
    .min(1)
    .required()
});
