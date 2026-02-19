const EmployeeService = require("../employees/employee.service");
const TimesheetService = require("../timesheets/timesheet.service");
const LeaveService = require("../leaves/leave.service");
const OrgSettingsService = require("../orgSettings/orgSettings.service");
const NotificationService = require("../notifications/notification.service");
const Holiday = require("../holidays/holiday.model");
const WeekOffService = require("../weekOffs/weekOff.service");
const Organization = require("../organizations/organization.model");
const OrgSettings = require("../orgSettings/orgSettings.model");
const Role = require("../roles/role.model");
const Permission = require("../permissions/permission.model");
const {
  isValidTimeZone,
  toDateKeyInTimeZone,
  addDaysToDateKey
} = require("../../utils/timezone");

const withQuery = (req, query) => ({
  ...req,
  query: {
    ...(req.query || {}),
    ...query
  }
});

const getOrganizationTimeZone = async (organizationId) => {
  const settings = await OrgSettings.findOne({ organizationId }).select("timezone");
  if (isValidTimeZone(settings?.timezone)) return settings.timezone;

  const organization = await Organization.findById(organizationId).select("timezone");
  if (isValidTimeZone(organization?.timezone)) return organization.timezone;
  return "UTC";
};

const getPermissionCodesForRequest = async (req) => {
  if (!req.user?.activeRoleId) return [];

  const roleInOrg = await Role.findOne({
    _id: req.user.activeRoleId,
    organizationId: req.user.organizationId
  }).lean();

  if (roleInOrg) {
    if (roleInOrg.isSystemRole) return ["*"];
    if (!roleInOrg.permissionIds?.length) return [];
    const permissions = await Permission.find({
      _id: { $in: roleInOrg.permissionIds },
      organizationId: req.user.organizationId
    }).select("code");
    return permissions.map((p) => p.code);
  }

  const fallbackRole = await Role.findById(req.user.activeRoleId).select("slug isSystemRole").lean();
  if (fallbackRole?.slug === "superadmin" || fallbackRole?.isSystemRole) return ["*"];
  return [];
};

const hasAnyPermission = (codes, required) => {
  if (!required || required.length === 0) return true;
  if (codes.includes("*")) return true;
  return required.some((code) => codes.includes(code));
};

exports.getSummary = async (req) => {
  const permissionCodes = await getPermissionCodesForRequest(req);
  const month = req.query?.month || toDateKeyInTimeZone(new Date(), "UTC").slice(0, 7);
  const year = Number(req.query?.year || new Date().getFullYear());
  const timeZone = await getOrganizationTimeZone(req.user.organizationId);
  const todayKey = toDateKeyInTimeZone(new Date(), timeZone);
  const start7Key = addDaysToDateKey(todayKey, -6);

  const canViewEmployees = hasAnyPermission(permissionCodes, ["EMP_VIEW"]);
  const canViewAttendance = hasAnyPermission(permissionCodes, ["TIMESHEET_VIEW_ALL"]);
  const canViewAttendanceMatrix = hasAnyPermission(permissionCodes, ["ATTENDANCE_VIEW_ALL"]);
  const canViewLeaves = hasAnyPermission(permissionCodes, ["LEAVE_VIEW_ALL"]);
  const canViewWeekly = hasAnyPermission(permissionCodes, ["TIMESHEET_VIEW_ALL"]);
  const canViewHolidays = hasAnyPermission(permissionCodes, ["HOLIDAY_VIEW"]);
  const canViewWeekOffs = hasAnyPermission(permissionCodes, ["WEEK_OFF_VIEW"]);
  const canViewOrgSettings = hasAnyPermission(permissionCodes, ["ORG_SETTINGS_VIEW"]);
  const canViewNotifications = hasAnyPermission(permissionCodes, ["NOTIFICATION_VIEW_SELF"]);

  const [
    employeesData,
    attendanceToday,
    attendanceLast7,
    matrixData,
    leaveList,
    weeklyList,
    holidays,
    weekOff,
    orgSettings,
    notificationsData
  ] = await Promise.all([
    canViewEmployees
      ? EmployeeService.listByOrganization(withQuery(req, { page: 1, limit: 500 }))
      : Promise.resolve({ items: [], pagination: null }),
    canViewAttendance
      ? TimesheetService.getAttendance(withQuery(req, { startDate: todayKey, endDate: todayKey }))
      : Promise.resolve([]),
    canViewAttendance
      ? TimesheetService.getAttendance(withQuery(req, { startDate: start7Key, endDate: todayKey }))
      : Promise.resolve([]),
    canViewAttendanceMatrix
      ? TimesheetService.getAttendanceMatrix(withQuery(req, { month }))
      : Promise.resolve({ employees: [] }),
    canViewLeaves
      ? LeaveService.getAllLeaves(req)
      : Promise.resolve([]),
    canViewWeekly
      ? TimesheetService.getAllWeekly(req)
      : Promise.resolve([]),
    canViewHolidays
      ? Holiday.find({
        organizationId: req.user.organizationId,
        year
      }).sort({ date: 1 })
      : Promise.resolve([]),
    canViewWeekOffs
      ? WeekOffService.get(req)
      : Promise.resolve(null),
    canViewOrgSettings
      ? OrgSettingsService.get(req)
      : Promise.resolve(null),
    canViewNotifications
      ? NotificationService.getMyNotifications(withQuery(req, { limit: 6 }))
      : Promise.resolve({ items: [] })
  ]);

  return {
    employeeList: employeesData?.items || [],
    attendanceToday: attendanceToday || [],
    attendanceLast7: attendanceLast7 || [],
    attendanceMatrix: matrixData?.employees || [],
    leaveList: leaveList || [],
    weeklyList: weeklyList || [],
    holidays: holidays || [],
    weekOffDays: weekOff?.weekOffDays || [],
    orgSettings: orgSettings || null,
    notifications: notificationsData?.items || []
  };
};

