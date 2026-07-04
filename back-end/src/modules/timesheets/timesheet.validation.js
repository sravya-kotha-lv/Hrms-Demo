const Joi = require("joi");

const localDateSchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

const entrySchema = Joi.object({
  date: Joi.date().required(),
  hours: Joi.number().min(0).max(24).required(),
  notes: Joi.string().allow("").max(500).optional()
});

exports.createWeeklySchema = Joi.object({
  weekStart: Joi.date().optional(),
  entries: Joi.array().items(entrySchema).optional()
});

exports.checkInSchema = Joi.object({
  clientIp: Joi.string().trim().allow("", null).optional(),
  publicIp: Joi.string().trim().allow("", null).optional(),
  ipAddress: Joi.string().trim().allow("", null).optional(),
  deviceId: Joi.string().trim().allow("", null).optional(),
  accuracy: Joi.number().min(0).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  selfieImage: Joi.string().max(5 * 1024 * 1024).allow("").optional()
});

exports.checkOutSchema = Joi.object({
  clientIp: Joi.string().trim().allow("", null).optional(),
  publicIp: Joi.string().trim().allow("", null).optional(),
  ipAddress: Joi.string().trim().allow("", null).optional(),
  deviceId: Joi.string().trim().allow("", null).optional(),
  accuracy: Joi.number().min(0).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  selfieImage: Joi.string().max(5 * 1024 * 1024).allow("").optional()
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
  status: Joi.string().valid("present", "half_day_present", "absent").required()
});

exports.bulkOverrideAttendanceSchema = Joi.object({
  date: Joi.date().required(),
  status: Joi.string().valid("present", "half_day_present", "absent").required(),
  employeeIds: Joi.array().items(Joi.string().required()).min(1).required()
});

exports.lockAttendanceMonthSchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
});

exports.attendanceRequestDefaultsSchema = Joi.object({
  date: localDateSchema.required(),
  requestType: Joi.string().valid("work_from_home").optional()
});

exports.raiseAttendanceRequestSchema = Joi.object({
  date: localDateSchema.required(),
  requestType: Joi.string().valid("missed_checkout", "correction", "work_from_home").required(),
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
