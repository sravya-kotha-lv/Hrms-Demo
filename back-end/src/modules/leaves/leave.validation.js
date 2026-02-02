const Joi = require("joi");

exports.applyLeaveSchema = Joi.object({
  leaveTypeId: Joi.string().required(),
  fromDate: Joi.date().required(),
  toDate: Joi.date().required(),
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
