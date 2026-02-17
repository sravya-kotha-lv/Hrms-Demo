const Joi = require("joi");

exports.upsertOrgSettingsSchema = Joi.object({
  leaveCreditFrequency: Joi.string().valid("monthly", "quarterly", "yearly").required(),
  leaveTypeCreditMode: Joi.string().valid("current_month_onwards", "full_year").required(),
  sandwichRuleEnabled: Joi.boolean().default(false),
  attendanceLockEnabled: Joi.boolean().default(false),
  attendanceLockAfterDays: Joi.number().integer().min(0).max(365).default(7),
  attendanceLockMode: Joi.string().valid("days_window", "payroll_cutoff").default("days_window"),
  timezone: Joi.string().required(),
  payrollCutoffDay: Joi.number().integer().min(1).max(31).default(25),
  minWorkHoursPerDay: Joi.number().min(0).max(24).required(),
  minHalfDayHours: Joi.number().min(0).max(24).max(Joi.ref("minWorkHoursPerDay")).required()
});
