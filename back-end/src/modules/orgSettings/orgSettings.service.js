const OrgSettings = require("./orgSettings.model");

const DEFAULTS = {
  leaveCreditFrequency: "monthly",
  leaveTypeCreditMode: "current_month_onwards",
  sandwichRuleEnabled: false,
  attendanceLockEnabled: false,
  attendanceLockAfterDays: 7,
  attendanceLockMode: "days_window",
  payrollCutoffDay: 25,
  minWorkHoursPerDay: 8,
  minHalfDayHours: 4
};

exports.get = async (req) => {
  let settings = await OrgSettings.findOne({
    organizationId: req.user.organizationId
  });

  if (!settings) {
    settings = await OrgSettings.create({
      organizationId: req.user.organizationId,
      ...DEFAULTS
    });
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
    payrollCutoffDay,
    minWorkHoursPerDay,
    minHalfDayHours
  } = req.body;

  const settings = await OrgSettings.findOneAndUpdate(
    { organizationId: req.user.organizationId },
    {
      leaveCreditFrequency,
      leaveTypeCreditMode,
      sandwichRuleEnabled,
      attendanceLockEnabled,
      attendanceLockAfterDays,
      attendanceLockMode,
      payrollCutoffDay,
      minWorkHoursPerDay,
      minHalfDayHours
    },
    { upsert: true, new: true }
  );

  return settings;
};
