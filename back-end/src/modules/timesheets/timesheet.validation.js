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

exports.bulkOverrideAttendanceSchema = Joi.object({
  date: Joi.date().required(),
  status: Joi.string().valid("present", "absent").required(),
  employeeIds: Joi.array().items(Joi.string().required()).min(1).required()
});

exports.raiseAttendanceRequestSchema = Joi.object({
  date: Joi.date().required(),
  requestType: Joi.string().valid("missed_checkout", "correction").required(),
  requestedCheckInTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow(null, ""),
  requestedCheckOutTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).allow(null, ""),
  reason: Joi.string().trim().min(3).max(500).required()
});

exports.attendanceRequestActionSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  rejectionReason: Joi.when("status", {
    is: "rejected",
    then: Joi.string().trim().min(3).required(),
    otherwise: Joi.optional()
  })
});
