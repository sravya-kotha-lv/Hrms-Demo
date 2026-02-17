const OrgSettings = require("./orgSettings.model");
const Organization = require("../organizations/organization.model");
const { isValidTimeZone } = require("../../utils/timezone");

const DEFAULTS = {
  leaveCreditFrequency: "monthly",
  leaveTypeCreditMode: "current_month_onwards",
  sandwichRuleEnabled: false,
  attendanceLockEnabled: false,
  attendanceLockAfterDays: 7,
  attendanceLockMode: "days_window",
  timezone: "UTC",
  payrollCutoffDay: 25,
  minWorkHoursPerDay: 8,
  minHalfDayHours: 4
};

exports.get = async (req) => {
  const org = await Organization.findById(req.user.organizationId).select("timezone");
  const organizationTimeZone = isValidTimeZone(org?.timezone) ? org.timezone : "UTC";

  let settings = await OrgSettings.findOne({
    organizationId: req.user.organizationId
  });

  if (!settings) {
    settings = await OrgSettings.create({
      organizationId: req.user.organizationId,
      ...DEFAULTS,
      timezone: organizationTimeZone
    });
  } else if (!isValidTimeZone(settings.timezone)) {
    settings.timezone = organizationTimeZone;
    await settings.save();
  }

  return settings;
};

exports.upsert = async (req) => {
  const {
    leaveCreditFrequency,
    leaveTypeCreditMode,
    sandwichRuleEnabled,
    attendanceLockEnabled,
    attendanceLockAfterDays,
    attendanceLockMode,
    timezone,
    payrollCutoffDay,
    minWorkHoursPerDay,
    minHalfDayHours
  } = req.body;

  if (!isValidTimeZone(timezone)) {
    throw new Error("Invalid timezone");
  }

  const settings = await OrgSettings.findOneAndUpdate(
    { organizationId: req.user.organizationId },
    {
      leaveCreditFrequency,
      leaveTypeCreditMode,
      sandwichRuleEnabled,
      attendanceLockEnabled,
      attendanceLockAfterDays,
      attendanceLockMode,
      timezone,
      payrollCutoffDay,
      minWorkHoursPerDay,
      minHalfDayHours
    },
    { upsert: true, new: true }
  );

  await Organization.findByIdAndUpdate(req.user.organizationId, { timezone });

  return settings;
};
