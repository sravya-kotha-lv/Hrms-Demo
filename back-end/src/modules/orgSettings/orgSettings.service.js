const OrgSettings = require("./orgSettings.model");

const DEFAULTS = {
  leaveCreditFrequency: "monthly"
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
  const { leaveCreditFrequency } = req.body;

  const settings = await OrgSettings.findOneAndUpdate(
    { organizationId: req.user.organizationId },
    { leaveCreditFrequency },
    { upsert: true, new: true }
  );

  return settings;
};
