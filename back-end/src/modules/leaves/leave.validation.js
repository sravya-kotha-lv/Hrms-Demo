const Joi = require("joi");

exports.applyLeaveSchema = Joi.object({
  leaveTypeId: Joi.string().required(),
  fromDate: Joi.date().required(),
  toDate: Joi.date().required(),
  duration: Joi.string().valid("full_day", "half_day").default("full_day"),
  halfDaySession: Joi.when("duration", {
    is: "half_day",
    then: Joi.string().valid("first_half", "second_half").required(),
    otherwise: Joi.optional().allow(null, "")
  }),
  reason: Joi.string().min(3).required()
});

exports.leaveActionSchema = Joi.object({
  status: Joi.string()
    .valid("approved", "rejected", "cancelled")
    .required(),

  rejectionReason: Joi.when("status", {
    is: "rejected",
    then: Joi.string().min(3).required(),
    otherwise: Joi.optional()
  })
});
