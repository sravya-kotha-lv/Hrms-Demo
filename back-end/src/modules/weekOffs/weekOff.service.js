const WeekOff = require("./weekOff.model");

exports.upsert = async (req) => {
  const { weekOffDays } = req.body;

  const config = await WeekOff.findOneAndUpdate(
    { organizationId: req.user.organizationId },
    { weekOffDays },
    { upsert: true, new: true }
  );

  return config;
};

exports.get = async (req) => {
  return WeekOff.findOne({
    organizationId: req.user.organizationId
  });
};
