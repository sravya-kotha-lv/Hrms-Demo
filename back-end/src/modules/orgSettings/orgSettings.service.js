const OrgSettings = require("./orgSettings.model");
const Organization = require("../organizations/organization.model");
const { isValidTimeZone } = require("../../utils/timezone");
const { getDefaultMaxActiveLoginsPerUser } = require("../../utils/orgSettingsDefaults");
const { ensurePayrollTenantAndDefaults } = require("../payroll/payrollProvisioning.service");

const DEFAULT_MAX_ACTIVE_LOGINS_PER_USER = getDefaultMaxActiveLoginsPerUser();

const DEFAULTS = {
  leaveCreditFrequency: "monthly",
  leaveTypeCreditMode: "current_month_onwards",
  sandwichRuleEnabled: false,
  attendanceLockEnabled: true,
  attendanceLockAfterDays: 7,
  attendanceLockMode: "payroll_cutoff",
  timezone: "Asia/Kolkata",
  payrollCutoffDay: 25,
  payrollSalaryPayDay: 30,
  payrollEnabled: false,
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
  maxActiveLoginsPerUser: DEFAULT_MAX_ACTIVE_LOGINS_PER_USER
};

exports.get = async (req) => {
  const org = await Organization.findById(req.user.organizationId).select("timezone");
  const organizationTimeZone = isValidTimeZone(org?.timezone) ? org.timezone : "Asia/Kolkata";

  let settings = await OrgSettings.findOneAndUpdate(
    { organizationId: req.user.organizationId },
    {
      $setOnInsert: {
        organizationId: req.user.organizationId,
        ...DEFAULTS,
        timezone: organizationTimeZone
      }
    },
    {
      new: true,
      upsert: true
    }
  );

  if (!settings) {
    settings = await OrgSettings.findOne({
      organizationId: req.user.organizationId,
    });
  }

  if (!isValidTimeZone(settings.timezone)) {
    settings.timezone = organizationTimeZone;
    await settings.save();
  } 

  if (
    settings.maxActiveLoginsPerUser === undefined
    || settings.maxActiveLoginsPerUser === null
  ) {
    settings.maxActiveLoginsPerUser = DEFAULT_MAX_ACTIVE_LOGINS_PER_USER;
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
    payrollSalaryPayDay,
    payrollEnabled,
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
      payrollSalaryPayDay,
      payrollEnabled,
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

  if (settings.payrollEnabled) {
    await ensurePayrollTenantAndDefaults({
      organizationId: req.user.organizationId,
      actorId: req.user.userId,
      orgSettings: settings.toObject ? settings.toObject() : settings
    });
  }

  return settings;
};
