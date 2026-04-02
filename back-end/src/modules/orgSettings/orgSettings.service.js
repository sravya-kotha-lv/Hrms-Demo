const OrgSettings = require("./orgSettings.model");
const Organization = require("../organizations/organization.model");
const { isValidTimeZone } = require("../../utils/timezone");

const DEFAULTS = {
  leaveCreditFrequency: "monthly",
  leaveTypeCreditMode: "current_month_onwards",
  sandwichRuleEnabled: false,
  attendanceLockEnabled: true,
  attendanceLockAfterDays: 7,
  attendanceLockMode: "payroll_cutoff",
  timezone: "Asia/Kolkata",
  payrollCutoffDay: 25,
  minWorkHoursPerDay: 8,
  minHalfDayHours: 4,
  attendanceIpEnabled: false,
  attendanceAllowedIp: "",
  attendanceSelfieRequired: false,
  attendanceGeoFenceEnabled: false,
  attendanceGeoLatitude: null,
  attendanceGeoLongitude: null,
  attendanceGeoRadiusMeters: 200,
  attendanceDevBypassEnabled: false,
  probationPeriodDays: 90,
  noticePeriodDays: 30,
  employeeIdPrefix: "",
  maxActiveLoginsPerUser: 1
};

exports.get = async (req) => {
  const org = await Organization.findById(req.user.organizationId).select("timezone");
  const organizationTimeZone = isValidTimeZone(org?.timezone) ? org.timezone : "Asia/Kolkata";

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
    minHalfDayHours,
    attendanceIpEnabled,
    attendanceAllowedIp,
    attendanceSelfieRequired,
    attendanceGeoFenceEnabled,
    attendanceGeoLatitude,
    attendanceGeoLongitude,
    attendanceGeoRadiusMeters,
    attendanceDevBypassEnabled,
    probationPeriodDays,
    noticePeriodDays,
    employeeIdPrefix,
    maxActiveLoginsPerUser
  } = req.body;

  if (!isValidTimeZone(timezone)) {
    throw { code: 400, statusCode: 400, message: "Invalid timezone" };
  }
  const enabledModesCount = [attendanceIpEnabled, attendanceSelfieRequired, attendanceGeoFenceEnabled]
    .filter(Boolean).length;
  if (enabledModesCount > 1) {
    throw {
      code: 400,
      statusCode: 400,
      message: "Only one attendance check-in restriction can be enabled at a time"
    };
  }
  if (attendanceIpEnabled && !(attendanceAllowedIp || "").trim()) {
    throw {
      code: 400,
      statusCode: 400,
      message: "Allowed office IP is required when IP restriction is enabled"
    };
  }
  if (
    attendanceGeoFenceEnabled
    && (
      attendanceGeoLatitude === null
      || attendanceGeoLongitude === null
      || attendanceGeoLatitude === undefined
      || attendanceGeoLongitude === undefined
    )
  ) {
    throw {
      code: 400,
      statusCode: 400,
      message: "Office latitude and longitude are required when geofencing is enabled"
    };
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
      minHalfDayHours,
      attendanceIpEnabled,
      attendanceAllowedIp: (attendanceAllowedIp || "").trim(),
      attendanceSelfieRequired,
      attendanceGeoFenceEnabled,
      attendanceGeoLatitude,
      attendanceGeoLongitude,
      attendanceGeoRadiusMeters,
      attendanceDevBypassEnabled,
      probationPeriodDays,
      noticePeriodDays,
      employeeIdPrefix: (employeeIdPrefix || "").trim().toUpperCase(),
      maxActiveLoginsPerUser
    },
    { upsert: true, new: true }
  );

  await Organization.findByIdAndUpdate(req.user.organizationId, { timezone });

  return settings;
};
