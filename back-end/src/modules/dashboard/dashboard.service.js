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
  addDaysToDateKey,
  getWeekdayForDateKey
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
  return "Asia/Kolkata";
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

const getEmployeeExternalId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.employeeId) return getEmployeeExternalId(value.employeeId);
  }
  return null;
};

const isActiveEmployee = (employee) => {
  if (!employee) return false;
  return employee.status !== "resigned" && employee.employmentLifecycleStatus !== "terminated";
};

const isApprovedLeaveOnDate = (leave, dateKey, timeZone) => {
  if (leave?.status !== "approved") return false;
  const fromKey = toDateKeyInTimeZone(leave.fromDate, timeZone);
  const toKey = toDateKeyInTimeZone(leave.toDate, timeZone);
  return dateKey >= fromKey && dateKey <= toKey;
};

const buildLeaveIndex = (leaves, timeZone, fromKey, toKey) => {
  const index = new Set();
  (leaves || []).forEach((leave) => {
    if (leave?.status !== "approved") return;
    let cursor = toDateKeyInTimeZone(leave.fromDate, timeZone);
    const end = toDateKeyInTimeZone(leave.toDate, timeZone);
    while (cursor && cursor <= end && cursor <= toKey) {
      if (cursor >= fromKey) {
        index.add(`${String(leave.employeeId?._id || leave.employeeId)}-${cursor}`);
      }
      cursor = addDaysToDateKey(cursor, 1);
    }
  });
  return index;
};

const buildDashboardStats = ({
  employees,
  attendanceToday,
  attendanceLast7,
  attendanceLast30,
  leaveList,
  holidays,
  weekOffMap,
  timeZone,
  todayKey
}) => {
  const holidayKeyMap = new Map(
    (holidays || []).map((holiday) => [toDateKeyInTimeZone(holiday.date, timeZone), holiday.name])
  );
  const todayAttendanceMap = new Map(
    (attendanceToday || []).map((row) => [String(row.employeeId?._id || row.employeeId), row])
  );
  const start7Key = addDaysToDateKey(todayKey, -6);
  const start30Key = addDaysToDateKey(todayKey, -29);
  const leaveIndex = buildLeaveIndex(leaveList, timeZone, start7Key, todayKey);
  const leaveIndex30 = buildLeaveIndex(leaveList, timeZone, start30Key, todayKey);
  const attendanceLast7Map = new Map(
    (attendanceLast7 || []).map((row) => {
      const employeeId = String(row.employeeId?._id || row.employeeId);
      const dateKey = toDateKeyInTimeZone(row.checkInAt || row.checkOutAt || row.date, timeZone);
      return [`${employeeId}-${dateKey}`, row];
    })
  );
  const attendanceLast30Map = new Map(
    (attendanceLast30 || []).map((row) => {
      const employeeId = String(row.employeeId?._id || row.employeeId);
      const dateKey = toDateKeyInTimeZone(row.checkInAt || row.checkOutAt || row.date, timeZone);
      return [`${employeeId}-${dateKey}`, row];
    })
  );

  const todayStatusList = (employees || []).map((employee) => {
    const employeeId = String(employee._id);
    const attendance = todayAttendanceMap.get(employeeId) || null;
    const holidayName = holidayKeyMap.get(todayKey) || null;
    const employeeWeekOffDays = weekOffMap.employeeMap.get(employeeId) || weekOffMap.defaultDays || [];
    const isWeekOff = employeeWeekOffDays.includes(getWeekdayForDateKey(todayKey, timeZone));
    const isOnLeave = (leaveList || []).some((leave) =>
      String(leave.employeeId?._id || leave.employeeId) === employeeId
      && isApprovedLeaveOnDate(leave, todayKey, timeZone)
    );
    const hasAttendance = Boolean(attendance?.checkInAt || attendance?.checkOutAt);
    const isPendingCheckout = Boolean(attendance?.checkInAt && !attendance?.checkOutAt);
    const countAsAbsent = !holidayName
      && !isWeekOff
      && !isOnLeave
      && !hasAttendance;

    return {
      employeeId,
      holidayName,
      isWeekOff,
      isOnLeave,
      checkInAt: attendance?.checkInAt || null,
      checkOutAt: attendance?.checkOutAt || null,
      lateByMinutes: Number(attendance?.lateByMinutes || 0),
      shiftStartTime: attendance?.shiftStartTime || employee?.shiftId?.startTime || null,
      overriddenBy: attendance?.overriddenBy || null,
      overriddenAt: attendance?.overriddenAt || null,
      present: hasAttendance,
      pendingCheckout: isPendingCheckout,
      absent: countAsAbsent
    };
  });

  const kpis = {
    totalEmployees: employees.length,
    presentToday: todayStatusList.filter((item) => item.present).length,
    absentToday: todayStatusList.filter((item) => item.absent).length,
    checkedInOnly: todayStatusList.filter((item) => item.pendingCheckout).length,
    lateArrivals: todayStatusList.filter((item) => item.present && item.lateByMinutes > 0).length,
    onLeaveToday: todayStatusList.filter((item) => item.isOnLeave).length
  };

  const monthDaySummary = {
    present: todayStatusList.filter((item) => item.present && !item.pendingCheckout).length,
    pendingCheckout: todayStatusList.filter((item) => item.pendingCheckout).length,
    absent: todayStatusList.filter((item) => item.absent).length,
    onLeave: todayStatusList.filter((item) => item.isOnLeave).length,
    weekOff: todayStatusList.filter((item) => item.isWeekOff).length,
    holiday: todayStatusList.filter((item) => Boolean(item.holidayName)).length,
    overridden: todayStatusList.filter((item) => item.overriddenBy || item.overriddenAt).length
  };

  const groupedDepartments = {};
  (employees || []).forEach((employee) => {
    const dept = employee.departmentId?.name || "Unassigned";
    if (!groupedDepartments[dept]) {
      groupedDepartments[dept] = { name: dept, employees: 0, present: 0, onLeave: 0, absent: 0 };
    }
    groupedDepartments[dept].employees += 1;
    const status = todayStatusList.find((item) => item.employeeId === String(employee._id));
    if (!status) return;
    if (status.isOnLeave) groupedDepartments[dept].onLeave += 1;
    else if (status.present) groupedDepartments[dept].present += 1;
    else if (status.absent) groupedDepartments[dept].absent += 1;
  });

  const departmentAnalytics = Object.values(groupedDepartments)
    .sort((a, b) => b.employees - a.employees)
    .slice(0, 6);

  const attendanceTrend = Array.from({ length: 7 }).map((_, idx) => {
    const key = addDaysToDateKey(start7Key, idx);
    let present = 0;
    let absent = 0;
    let excluded = 0;

    (employees || []).forEach((employee) => {
      const employeeId = String(employee._id);
      const holidayName = holidayKeyMap.get(key) || null;
      const employeeWeekOffDays = weekOffMap.employeeMap.get(employeeId) || weekOffMap.defaultDays || [];
      const isWeekOff = employeeWeekOffDays.includes(getWeekdayForDateKey(key, timeZone));
      const isOnLeave = leaveIndex.has(`${employeeId}-${key}`);
      const attendance = attendanceLast7Map.get(`${employeeId}-${key}`) || null;

      if (holidayName || isWeekOff || isOnLeave) {
        excluded += 1;
        return;
      }

      if (attendance?.checkInAt || attendance?.checkOutAt) {
        present += 1;
        return;
      }

      absent += 1;
    });

    return {
      key,
      present,
      absent,
      excluded
    };
  });

  const attendanceTrendMonthly = Array.from({ length: 30 }).map((_, idx) => {
    const key = addDaysToDateKey(start30Key, idx);
    let present = 0;
    let absent = 0;
    let excluded = 0;

    (employees || []).forEach((employee) => {
      const employeeId = String(employee._id);
      const holidayName = holidayKeyMap.get(key) || null;
      const employeeWeekOffDays = weekOffMap.employeeMap.get(employeeId) || weekOffMap.defaultDays || [];
      const isWeekOff = employeeWeekOffDays.includes(getWeekdayForDateKey(key, timeZone));
      const isOnLeave = leaveIndex30.has(`${employeeId}-${key}`);
      const attendance = attendanceLast30Map.get(`${employeeId}-${key}`) || null;

      if (holidayName || isWeekOff || isOnLeave) {
        excluded += 1;
        return;
      }

      if (attendance?.checkInAt || attendance?.checkOutAt) {
        present += 1;
        return;
      }

      absent += 1;
    });

    return {
      key,
      present,
      absent,
      excluded
    };
  });

  return {
    todayStatusList,
    dashboardStats: {
      kpis,
      monthDaySummary,
      departmentAnalytics,
      attendanceTrend,
      attendanceTrendMonthly
    }
  };
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
    attendanceLast30,
    leaveList,
    weeklyList,
    holidays,
    orgSettings,
    notificationsData
  ] = await Promise.all([
    canViewEmployees
      ? EmployeeService.listByOrganization(req)
      : Promise.resolve({ items: [], pagination: null }),
    canViewAttendance
      ? TimesheetService.getAttendance(withQuery(req, { startDate: todayKey, endDate: todayKey }))
      : Promise.resolve([]),
    canViewAttendance
      ? TimesheetService.getAttendance(withQuery(req, { startDate: start7Key, endDate: todayKey }))
      : Promise.resolve([]),
    canViewAttendance
      ? TimesheetService.getAttendance(withQuery(req, { startDate: addDaysToDateKey(todayKey, -29), endDate: todayKey }))
      : Promise.resolve([]),
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
    canViewOrgSettings
      ? OrgSettingsService.get(req)
      : Promise.resolve(null),
    canViewNotifications
      ? NotificationService.getMyNotifications(withQuery(req, { limit: 6 }))
      : Promise.resolve({ items: [] })
  ]);

  const activeEmployees = (employeesData?.items || []).filter(isActiveEmployee);
  const weekOffMap = canViewWeekOffs || canViewAttendance
    ? await WeekOffService.resolveWeekOffMapForEmployees({
      organizationId: req.user.organizationId,
      employees: activeEmployees
    })
    : { defaultDays: [], employeeMap: new Map() };
  const activeEmployeeIds = new Set(activeEmployees.map((employee) => String(employee._id)));

  const activeAttendanceToday = (attendanceToday || []).filter((row) => {
    const employeeId = getEmployeeExternalId(row?.employeeId);
    return Boolean(employeeId && activeEmployeeIds.has(employeeId));
  });

  const activeAttendanceLast7 = (attendanceLast7 || []).filter((row) => {
    const employeeId = getEmployeeExternalId(row?.employeeId);
    return Boolean(employeeId && activeEmployeeIds.has(employeeId));
  });

  const activeLeaves = (leaveList || []).filter((row) => {
    const employeeId = getEmployeeExternalId(row?.employeeId);
    return Boolean(employeeId && activeEmployeeIds.has(employeeId));
  });

  const activeWeekly = (weeklyList || []).filter((row) => {
    const employeeId = getEmployeeExternalId(row?.employeeId);
    return Boolean(employeeId && activeEmployeeIds.has(employeeId));
  });

  const { todayStatusList, dashboardStats } = buildDashboardStats({
    employees: activeEmployees,
    attendanceToday: activeAttendanceToday,
    attendanceLast7: activeAttendanceLast7,
    attendanceLast30: (attendanceLast30 || []).filter((row) => {
      const employeeId = getEmployeeExternalId(row?.employeeId);
      return Boolean(employeeId && activeEmployeeIds.has(employeeId));
    }),
    leaveList: activeLeaves,
    holidays: holidays || [],
    weekOffMap: weekOffMap || { defaultDays: [], employeeMap: new Map() },
    timeZone,
    todayKey
  });

  return {
    employeeList: activeEmployees,
    attendanceToday: activeAttendanceToday,
    attendanceLast7: activeAttendanceLast7,
    attendanceMatrix: [],
    leaveList: activeLeaves,
    weeklyList: activeWeekly,
    holidays: holidays || [],
    weekOffDays: weekOffMap?.defaultDays || [],
    todayStatusList,
    dashboardStats,
    orgSettings: orgSettings || null,
    notifications: notificationsData?.items || []
  };
};
