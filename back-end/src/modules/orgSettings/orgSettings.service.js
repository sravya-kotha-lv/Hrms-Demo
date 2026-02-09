const OrgSettings = require("./orgSettings.model");

const DEFAULTS = {
  leaveCreditFrequency: "monthly",
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
  const { leaveCreditFrequency, minWorkHoursPerDay, minHalfDayHours } = req.body;

  const settings = await OrgSettings.findOneAndUpdate(
    { organizationId: req.user.organizationId },
    { leaveCreditFrequency, minWorkHoursPerDay, minHalfDayHours },
    { upsert: true, new: true }
  );

  return settings;
};
