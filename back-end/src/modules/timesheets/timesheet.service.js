const Timesheet = require("./timesheet.model");
const Attendance = require("./timesheetAttendance.model");
const AttendanceRequest = require("./attendanceRequest.model");
const Employee = require("../employees/employee.model");
const Leave = require("../leaves/leave.model");
const { audit } = require("../auditLogs/auditLogs.service");
const Role = require("../roles/role.model");
const OrgSettings = require("../orgSettings/orgSettings.model");
const Organization = require("../organizations/organization.model");
const WeekOffService = require("../weekOffs/weekOff.service");
const Holiday = require("../holidays/holiday.model");
const AuditLog = require("../auditLogs/auditLogs.model");
const sendMail = require("../../utils/sendMail");
const { createNotificationSafe } = require("../notifications/notification.service");
const Shift = require("../shifts/shift.model");
const {
  resolveApplicableFlow,
  getActorApprovalContext,
  canActorApproveStep,
  resolveRecipientsForStep
} = require("../../utils/approvalFlowEngine");
const { advanceApprovalSteps, getCurrentPendingStep } = require("../../utils/approvalProgress");
const {
  isValidTimeZone,
  toDateKeyInTimeZone,
  addDaysToDateKey,
  zonedDateTimeToUtc,
  startOfDayInTimeZone,
  endOfDayInTimeZone,
  parseMonthRangeInTimeZone,
  getDayInTimeZone,
  getWeekdayForDateKey
} = require("../../utils/timezone");

const REQUEST_APPROVER_ROLE_SLUGS = new Set([
  "manager",
  "hr",
  "admin",
  "org-admin",
  "superadmin"
]);

const parseDateValue = (value) => {
  if (value instanceof Date) return new Date(value);
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      return new Date(year, month, day);
    }
  }
  return new Date(value);
};

const startOfDay = (value) => {
  const d = parseDateValue(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (value) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getWeekStart = (value, weekStartDay = 1) => {
  const d = startOfDay(value);
  const day = d.getDay();
  const diff = (day - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const getWeekEnd = (weekStart) => {
  const d = startOfDay(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
};

const buildWeekDates = (weekStart) => {
  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    const d = startOfDay(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const toDateKey = (value) => {
  const d = startOfDay(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const eachDateBetween = (from, to) => {
  const dates = [];
  const start = startOfDay(from);
  const end = startOfDay(to);
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const parseTimeToMinutes = (timeString) => {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return null;
  const [hh, mm] = timeString.split(":").map(Number);
  return hh * 60 + mm;
};

const buildScheduledDateTime = (dateValue, minutesFromMidnight) => {
  const d = startOfDay(dateValue);
  d.setMinutes(minutesFromMidnight);
  return d;
};

const getDefaultShift = () => ({
  _id: null,
  name: "General Shift",
  code: "GEN",
  startTime: "09:00",
  endTime: "18:00",
  graceMinutes: 0
});

const getOrganizationTimeZone = async (organizationId) => {
  const settings = await OrgSettings.findOne({ organizationId }).select("timezone");
  if (isValidTimeZone(settings?.timezone)) return settings.timezone;

  const organization = await Organization.findById(organizationId).select("timezone");
  if (isValidTimeZone(organization?.timezone)) return organization.timezone;

  return "UTC";
};

const resolveShiftSchedule = async (organizationId, employeeId, dateValue, timeZone = "UTC") => {
  const employee = await Employee.findOne({
    _id: employeeId,
    organizationId
  }).select("shiftId");

  let shift = null;
  if (employee?.shiftId) {
    shift = await Shift.findOne({
      _id: employee.shiftId,
      organizationId,
      status: "active"
    }).select("name code startTime endTime graceMinutes");
  }

  const effectiveShift = shift || getDefaultShift();
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))
    ? String(dateValue)
    : toDateKeyInTimeZone(dateValue, timeZone);
  const startMinutes = parseTimeToMinutes(effectiveShift.startTime);
  const endMinutes = parseTimeToMinutes(effectiveShift.endTime);

  const scheduledStartAt = zonedDateTimeToUtc(dateKey, effectiveShift.startTime, timeZone);
  let scheduledEndAt = zonedDateTimeToUtc(dateKey, effectiveShift.endTime, timeZone);

  // Overnight shift support, e.g. 22:00 -> 06:00
  if (endMinutes <= startMinutes) {
    scheduledEndAt = new Date(scheduledEndAt.getTime() + (24 * 60 * 60 * 1000));
  }

  return {
    shift: effectiveShift,
    scheduledStartAt,
    scheduledEndAt
  };
};

const resolveCheckInSchedule = async (organizationId, employeeId, now, timeZone) => {
  const todayKey = toDateKeyInTimeZone(now, timeZone);
  const yesterdayKey = addDaysToDateKey(todayKey, -1);

  const yesterdaySchedule = await resolveShiftSchedule(
    organizationId,
    employeeId,
    yesterdayKey,
    timeZone
  );

  const yesterdayStartMins = parseTimeToMinutes(yesterdaySchedule.shift.startTime);
  const yesterdayEndMins = parseTimeToMinutes(yesterdaySchedule.shift.endTime);
  const isYesterdayOvernight = yesterdayEndMins <= yesterdayStartMins;
  if (
    isYesterdayOvernight
    && now <= yesterdaySchedule.scheduledEndAt
  ) {
    return {
      attendanceDateKey: yesterdayKey,
      ...yesterdaySchedule
    };
  }

  const todaySchedule = await resolveShiftSchedule(
    organizationId,
    employeeId,
    todayKey,
    timeZone
  );

  return {
    attendanceDateKey: todayKey,
    ...todaySchedule
  };
};

const sendNotification = async ({ toEmail, toName, subject, message }) => {
  if (!toEmail) return;
  try {
    await sendMail("notification", toName || "User", subject, message, toEmail);
  } catch (_) {
    // non-blocking notification
  }
};

const notifyAttendanceApprovalStepAssignees = async ({
  organizationId,
  step,
  actorEmployeeId = null,
  title,
  message,
  type,
  meta = {}
}) => {
  if (!step) return;
  const recipients = await resolveRecipientsForStep({ organizationId, step });
  for (const recipient of recipients) {
    await createNotificationSafe({
      organizationId,
      recipientUserId: recipient.userId,
      recipientEmployeeId: recipient.employeeId,
      actorEmployeeId,
      type,
      title,
      message,
      meta
    });
  }
};

const sanitizeEntries = (entries, weekStart) => {
  const byDate = new Map();

  for (const entry of entries || []) {
    const key = toDateKey(entry.date);
    if (!byDate.has(key)) {
      byDate.set(key, {
        date: startOfDay(entry.date),
        hours: Number(entry.hours || 0),
        notes: entry.notes || ""
      });
    }
  }

  return buildWeekDates(weekStart).map((date) => {
    const key = toDateKey(date);
    const existing = byDate.get(key);
    if (existing) {
      return existing;
    }
    return { date, hours: 0, notes: "" };
  });
};

const combineDateAndTime = (dateValue, hhmm) => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [hh, mm] = hhmm.split(":").map(Number);
  const d = startOfDay(dateValue);
  d.setHours(hh, mm, 0, 0);
  return d;
};

const calculateTotalHours = (entries) =>
  (entries || []).reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);

const applyHoursToEntries = (entries, dateValue, hours) => {
  const key = toDateKey(dateValue);
  return (entries || []).map((entry) => {
    if (toDateKey(entry.date) === key) {
      return {
        ...entry,
        hours: Number(hours) || 0
      };
    }
    return entry;
  });
};

const upsertTimesheetHours = async ({
  organizationId,
  employeeId,
  dateValue,
  hoursWorked
}) => {
  const weekStart = getWeekStart(dateValue);
  const weekEnd = getWeekEnd(weekStart);
  let timesheet = await Timesheet.findOne({
    organizationId,
    employeeId,
    weekStart
  });

  if (!timesheet) {
    const entries = sanitizeEntries([], weekStart);
    timesheet = await Timesheet.create({
      organizationId,
      employeeId,
      weekStart,
      weekEnd,
      entries: applyHoursToEntries(entries, dateValue, hoursWorked),
      totalHours: Number(hoursWorked) || 0,
      status: "draft"
    });
    return timesheet;
  }

  if (["draft", "rejected"].includes(timesheet.status)) {
    const entries = sanitizeEntries(timesheet.entries || [], weekStart);
    timesheet.entries = applyHoursToEntries(entries, dateValue, hoursWorked);
    timesheet.totalHours = calculateTotalHours(timesheet.entries);
    await timesheet.save();
  }

  return timesheet;
};

exports.upsertTimesheetHours = upsertTimesheetHours;

const ensureEntriesInWeek = (entries, weekStart, weekEnd) => {
  const start = startOfDay(weekStart);
  const end = endOfDay(weekEnd);
  for (const entry of entries || []) {
    const d = startOfDay(entry.date);
    if (d < start || d > end) {
      throw new Error("Entries must be within the selected week");
    }
  }
};

const validateHours = async (req, entries) => {
  const settings = await OrgSettings.findOne({
    organizationId: req.user.organizationId
  });
  const minWork = settings?.minWorkHoursPerDay ?? 8;
  const minHalf = settings?.minHalfDayHours ?? 4;

  for (const entry of entries || []) {
    const hours = Number(entry.hours || 0);
    if (hours > 0 && hours < minHalf) {
      throw new Error(`Minimum half day hours is ${minHalf}`);
    }
    if (hours >= minHalf && hours < minWork) {
      // half day allowed
      continue;
    }
  }
};

const resolveWorkedMinutes = (attendanceRow) => {
  const explicitMinutes = Number(attendanceRow?.totalMinutes || 0);
  if (explicitMinutes > 0) return explicitMinutes;

  if (attendanceRow?.checkInAt && attendanceRow?.checkOutAt) {
    return Math.max(
      0,
      Math.round((new Date(attendanceRow.checkOutAt).getTime() - new Date(attendanceRow.checkInAt).getTime()) / 60000)
    );
  }

  return 0;
};

const resolveAttendanceMatrixStatus = (attendanceRow, { minHalfDayHours = 4, minWorkHoursPerDay = 8 }) => {
  const isOpenSession = Boolean(attendanceRow?.checkInAt && !attendanceRow?.checkOutAt);
  if (isOpenSession) return "pending_checkout";

  const hasAnyAttendance = Boolean(attendanceRow?.checkInAt || attendanceRow?.checkOutAt);
  if (!hasAnyAttendance) return "absent";

  const workedMinutes = resolveWorkedMinutes(attendanceRow);
  const halfDayMinutes = Math.max(0, Number(minHalfDayHours || 0) * 60);
  const fullDayMinutes = Math.max(halfDayMinutes, Number(minWorkHoursPerDay || 0) * 60);

  if (workedMinutes >= fullDayMinutes) return "full_day_present";
  if (workedMinutes >= halfDayMinutes) return "half_day_present";
  return "absent";
};

const getEmployeeFromReq = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  if (!employee) throw new Error("Employee not found");
  return employee;
};

const parseMonthRange = (monthValue) => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (typeof monthValue === "string" && /^\d{4}-\d{2}$/.test(monthValue)) {
    const [y, m] = monthValue.split("-").map(Number);
    year = y;
    month = m;
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const daysInMonth = end.getDate();
  return { year, month, start, end, daysInMonth };
};

const getScopedEmployeeIdsForViewer = async (req) => {
  if (!req.user.activeRoleId) return null;

  const role = await Role.findOne({
    _id: req.user.activeRoleId,
    organizationId: req.user.organizationId
  }).select("slug");

  if (role?.slug !== "manager") return null;

  const managerEmployee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  }).select("_id");

  if (!managerEmployee) return [];

  return Employee.find({
    organizationId: req.user.organizationId,
    managerId: managerEmployee._id
  }).distinct("_id");
};

const getActorRoleSlug = async (req) => {
  if (!req.user.activeRoleId) return "";
  const role = await Role.findOne({
    _id: req.user.activeRoleId,
    organizationId: req.user.organizationId
  }).select("slug");
  return role?.slug || "";
};

const assertManageAccessForEmployee = async (req, employeeId) => {
  if (!req.user.activeRoleId) return;

  const role = await Role.findOne({
    _id: req.user.activeRoleId,
    organizationId: req.user.organizationId
  }).select("slug");

  if (role?.slug !== "manager") return;

  const managerEmployee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  }).select("_id");

  if (!managerEmployee) {
    throw new Error("Access denied");
  }

  const reportIds = await Employee.find({
    organizationId: req.user.organizationId,
    managerId: managerEmployee._id
  }).distinct("_id");

  const allowed = reportIds.some((id) => id.toString() === employeeId.toString());
  if (!allowed) {
    throw new Error("Access denied");
  }
};

const validateAttendanceEditWindow = async (organizationId, dateValue, timeZone = "UTC") => {
  const settings = await OrgSettings.findOne({ organizationId })
    .select("attendanceLockEnabled attendanceLockAfterDays attendanceLockMode payrollCutoffDay");

  const target = startOfDayInTimeZone(dateValue, timeZone);
  const today = startOfDayInTimeZone(new Date(), timeZone);
  const targetKey = toDateKeyInTimeZone(target, timeZone);
  const todayKey = toDateKeyInTimeZone(today, timeZone);

  // Never allow attendance overrides on future dates.
  if (targetKey > todayKey) {
    throw new Error("Attendance cannot be updated for future dates");
  }

  if (!settings?.attendanceLockEnabled) return;

  const mode = settings.attendanceLockMode || "days_window";

  if (mode === "days_window") {
    const lockAfterDays = Number(settings.attendanceLockAfterDays ?? 7);
    const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > lockAfterDays) {
      throw new Error(`Attendance is locked for dates older than ${lockAfterDays} days`);
    }
    return;
  }

  const cutoffDay = Number(settings.payrollCutoffDay ?? 25);
  const currentDay = getDayInTimeZone(today, timeZone);

  // payroll_cutoff mode policy:
  // - Before cutoff day: allow current + previous month edits.
  // - On/after cutoff day: lock previous month; allow only current month dates.
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const periodStartKey = currentDay >= cutoffDay
    ? `${todayYear}-${String(todayMonth).padStart(2, "0")}-01`
    : `${todayMonth === 1 ? todayYear - 1 : todayYear}-${String(todayMonth === 1 ? 12 : todayMonth - 1).padStart(2, "0")}-01`;

  if (targetKey < periodStartKey) {
    throw new Error(`Attendance is locked before payroll period start ${periodStartKey}`);
  }
};

exports.checkIn = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const now = new Date();
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const {
    attendanceDateKey,
    shift,
    scheduledStartAt,
    scheduledEndAt
  } = await resolveCheckInSchedule(
    req.user.organizationId,
    employee._id,
    now,
    organizationTimeZone
  );
  const attendanceDate = startOfDayInTimeZone(attendanceDateKey, organizationTimeZone);

  const graceMinutes = Number(shift.graceMinutes || 0);
  const lateDiff = Math.round((now.getTime() - scheduledStartAt.getTime()) / 60000) - graceMinutes;
  const lateByMinutes = Math.max(0, lateDiff);
  const earlyLoginByMinutes = Math.max(
    0,
    Math.round((scheduledStartAt.getTime() - now.getTime()) / 60000)
  );

  const openAttendance = await Attendance.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    checkInAt: { $ne: null },
    checkOutAt: null
  }).sort({ date: -1, checkInAt: -1 });

  if (openAttendance) {
    if (toDateKeyInTimeZone(openAttendance.date, organizationTimeZone) === attendanceDateKey) {
      throw new Error("Already checked in for this shift");
    }

    openAttendance.missedCheckout = true;
    openAttendance.missedCheckoutMarkedAt = now;
    openAttendance.missedCheckoutResolvedRequestId = null;
    await openAttendance.save();
  }

  const existing = await Attendance.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: attendanceDate
  });

  if (existing && existing.checkInAt && !existing.checkOutAt) {
    throw new Error("Already checked in for today");
  }

  if (existing && existing.checkOutAt) {
    throw new Error("Already checked out for today");
  }

  if (existing && !existing.checkInAt && !existing.checkOutAt) {
    existing.checkInAt = now;
    existing.totalMinutes = 0;
    existing.status = "checked_in";
    existing.overriddenBy = null;
    existing.overriddenAt = null;
    existing.shiftId = shift._id || null;
    existing.shiftName = shift.name;
    existing.shiftCode = shift.code;
    existing.shiftStartTime = shift.startTime;
    existing.shiftEndTime = shift.endTime;
    existing.scheduledStartAt = scheduledStartAt;
    existing.scheduledEndAt = scheduledEndAt;
    existing.lateByMinutes = lateByMinutes;
    existing.earlyLoginByMinutes = earlyLoginByMinutes;
    existing.earlyCheckoutByMinutes = 0;
    existing.overtimeMinutes = 0;
    existing.missedCheckout = false;
    existing.missedCheckoutMarkedAt = null;
    existing.missedCheckoutResolvedRequestId = null;
    await existing.save();
    return existing;
  }

  const attendance = await Attendance.create({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: attendanceDate,
    checkInAt: now,
    status: "checked_in",
    shiftId: shift._id || null,
    shiftName: shift.name,
    shiftCode: shift.code,
    shiftStartTime: shift.startTime,
    shiftEndTime: shift.endTime,
    scheduledStartAt,
    scheduledEndAt,
    lateByMinutes,
    earlyLoginByMinutes,
    earlyCheckoutByMinutes: 0,
    overtimeMinutes: 0,
    missedCheckout: false,
    missedCheckoutMarkedAt: null,
    missedCheckoutResolvedRequestId: null
  });

  await audit({
    req,
    module: "timesheets",
    action: "CHECK_IN",
    entityId: attendance._id,
    after: attendance.toObject()
  });

  return attendance;
};

exports.checkOut = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const now = new Date();
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);

  const attendance = await Attendance.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    checkInAt: { $ne: null },
    checkOutAt: null
  }).sort({ date: -1, checkInAt: -1 });

  if (!attendance || !attendance.checkInAt) {
    throw new Error("You are not checked in");
  }

  if (attendance.checkOutAt) {
    throw new Error("Already checked out for today");
  }

  const totalMinutes = Math.max(
    0,
    Math.round((now.getTime() - attendance.checkInAt.getTime()) / 60000)
  );

  const scheduledEnd = attendance.scheduledEndAt
    ? new Date(attendance.scheduledEndAt)
    : (
      await resolveShiftSchedule(
        req.user.organizationId,
        employee._id,
        toDateKeyInTimeZone(attendance.date, organizationTimeZone),
        organizationTimeZone
      )
    ).scheduledEndAt;
  const earlyCheckoutByMinutes = Math.max(
    0,
    Math.round((scheduledEnd.getTime() - now.getTime()) / 60000)
  );
  const overtimeMinutes = Math.max(
    0,
    Math.round((now.getTime() - scheduledEnd.getTime()) / 60000)
  );

  attendance.checkOutAt = now;
  attendance.totalMinutes = totalMinutes;
  attendance.status = "checked_out";
  attendance.overriddenBy = null;
  attendance.overriddenAt = null;
  attendance.earlyCheckoutByMinutes = earlyCheckoutByMinutes;
  attendance.overtimeMinutes = overtimeMinutes;
  attendance.missedCheckout = false;
  attendance.missedCheckoutMarkedAt = null;
  attendance.missedCheckoutResolvedRequestId = null;
  await attendance.save();

  // Update weekly timesheet hours for today
  const hoursWorked = Number((totalMinutes / 60).toFixed(2));
  await upsertTimesheetHours({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    dateValue: attendance.date,
    hoursWorked
  });

  await audit({
    req,
    module: "timesheets",
    action: "CHECK_OUT",
    entityId: attendance._id,
    before: { checkOutAt: null },
    after: attendance.toObject()
  });

  return attendance;
};

exports.getMyAttendance = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const queryDate = req.query.date ? new Date(req.query.date) : new Date();
  const dayStart = startOfDayInTimeZone(queryDate, organizationTimeZone);
  const dayEnd = endOfDayInTimeZone(queryDate, organizationTimeZone);

  return Attendance.find({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: { $gte: dayStart, $lte: dayEnd }
  }).sort({ date: -1 });
};

exports.getAttendance = async (req) => {
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const start = req.query.startDate ? new Date(req.query.startDate) : new Date();
  const end = req.query.endDate ? new Date(req.query.endDate) : start;

  const startDate = startOfDayInTimeZone(start, organizationTimeZone);
  const endDate = endOfDayInTimeZone(end, organizationTimeZone);

  const query = {
    organizationId: req.user.organizationId,
    date: { $gte: startDate, $lte: endDate }
  };

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        const reportIds = await Employee.find({
          organizationId: req.user.organizationId,
          managerId: managerEmployee._id
        }).distinct("_id");
        query.employeeId = { $in: reportIds };
      }
    }
  }

  return Attendance.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .sort({ date: -1, checkInAt: -1 });
};

exports.getAttendanceMatrix = async (req) => {
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const { year, month, start, end, daysInMonth } = parseMonthRangeInTimeZone(
    req.query.month,
    organizationTimeZone
  );

  const employeeQuery = {
    organizationId: req.user.organizationId,
    status: "active"
  };

  const scopedEmployeeIds = await getScopedEmployeeIdsForViewer(req);
  if (Array.isArray(scopedEmployeeIds)) {
    employeeQuery._id = { $in: scopedEmployeeIds };
  }

  const employees = await Employee.find(employeeQuery)
    .select("_id firstName lastName employeeCode shiftId")
    .sort({ firstName: 1, lastName: 1 });

  if (!employees.length) {
    return { year, month, daysInMonth, employees: [] };
  }

  const employeeIds = employees.map((e) => e._id);
  const [attendanceRows, holidays, approvedLeaves, weekOffMap, orgSettings] = await Promise.all([
    Attendance.find({
      organizationId: req.user.organizationId,
      employeeId: { $in: employeeIds },
      date: { $gte: start, $lte: end }
    })
      .select("employeeId date checkInAt checkOutAt totalMinutes overriddenBy overriddenAt shiftName shiftCode shiftStartTime shiftEndTime lateByMinutes earlyLoginByMinutes earlyCheckoutByMinutes overtimeMinutes missedCheckout missedCheckoutMarkedAt")
      .populate("overriddenBy", "firstName lastName"),
    Holiday.find({
      organizationId: req.user.organizationId,
      status: "active",
      date: { $gte: start, $lte: end }
    }).select("date name"),
    Leave.find({
      organizationId: req.user.organizationId,
      employeeId: { $in: employeeIds },
      status: "approved",
      fromDate: { $lte: end },
      toDate: { $gte: start }
    }).populate("leaveTypeId", "name"),
    WeekOffService.resolveWeekOffMapForEmployees({
      organizationId: req.user.organizationId,
      employees
    }),
    OrgSettings.findOne({ organizationId: req.user.organizationId }).select("minHalfDayHours minWorkHoursPerDay")
  ]);

  const holidayByDay = new Map();
  holidays.forEach((h) => {
    holidayByDay.set(getDayInTimeZone(h.date, organizationTimeZone), h.name);
  });

  const attendanceMap = new Map();
  attendanceRows.forEach((row) => {
    const day = getDayInTimeZone(row.date, organizationTimeZone);
    const key = `${row.employeeId.toString()}-${day}`;
    const overriddenByName = row.overriddenBy
      ? `${row.overriddenBy.firstName || ""} ${row.overriddenBy.lastName || ""}`.trim()
      : null;
    const isOpenSession = Boolean(row.checkInAt && !row.checkOutAt);
    const status = resolveAttendanceMatrixStatus(row, {
      minHalfDayHours: Number(orgSettings?.minHalfDayHours ?? 4),
      minWorkHoursPerDay: Number(orgSettings?.minWorkHoursPerDay ?? 8)
    });
    attendanceMap.set(key, {
      status,
      checkInAt: row.checkInAt || null,
      checkOutAt: row.checkOutAt || null,
      totalMinutes: Number(row.totalMinutes || 0),
      isOpenSession,
      excludeFromPayroll: isOpenSession,
      payrollReconciledByLeave: false,
      missedCheckout: Boolean(row.missedCheckout),
      missedCheckoutMarkedAt: row.missedCheckoutMarkedAt || null,
      overriddenBy: overriddenByName || null,
      overriddenAt: row.overriddenAt || null,
      shiftName: row.shiftName || null,
      shiftCode: row.shiftCode || null,
      shiftStartTime: row.shiftStartTime || null,
      shiftEndTime: row.shiftEndTime || null,
      lateByMinutes: Number(row.lateByMinutes || 0),
      earlyLoginByMinutes: Number(row.earlyLoginByMinutes || 0),
      earlyCheckoutByMinutes: Number(row.earlyCheckoutByMinutes || 0),
      overtimeMinutes: Number(row.overtimeMinutes || 0)
    });
  });

  const leaveMap = new Map();
  approvedLeaves.forEach((leave) => {
    const leaveStart = new Date(leave.fromDate) < start ? start : new Date(leave.fromDate);
    const leaveEnd = new Date(leave.toDate) > end ? end : new Date(leave.toDate);
    eachDateBetween(leaveStart, leaveEnd).forEach((d) => {
      const key = `${leave.employeeId.toString()}-${getDayInTimeZone(d, organizationTimeZone)}`;
      leaveMap.set(key, {
        isOnLeave: true,
        leaveType: leave.leaveTypeId?.name || "Leave",
        leaveDuration: leave.duration || "full_day",
        leaveHalfDaySession: leave.halfDaySession || null,
        leaveUnits: leave.duration === "half_day" ? 0.5 : 1
      });
    });
  });

  const data = employees.map((emp) => {
    const days = {};
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${emp._id.toString()}-${day}`;
      const base = attendanceMap.get(key);
      const leaveInfo = leaveMap.get(key) || {
        isOnLeave: false,
        leaveType: null,
        leaveDuration: null,
        leaveHalfDaySession: null,
        leaveUnits: 0
      };
      const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const weekday = getWeekdayForDateKey(dayKey, organizationTimeZone);
      const employeeWeekOffDays = weekOffMap.employeeMap.get(String(emp._id)) || weekOffMap.defaultDays || [];
      const isWeekOff = employeeWeekOffDays.includes(weekday);
      const holidayName = holidayByDay.get(day) || null;
      days[day] = base || {
        status: "absent",
        checkInAt: null,
        checkOutAt: null,
        isOpenSession: false,
        excludeFromPayroll: false,
        payrollReconciledByLeave: false,
        missedCheckout: false,
        missedCheckoutMarkedAt: null,
        overriddenBy: null,
        overriddenAt: null,
        shiftName: null,
        shiftCode: null,
        shiftStartTime: null,
        shiftEndTime: null,
        lateByMinutes: 0,
        earlyLoginByMinutes: 0,
        earlyCheckoutByMinutes: 0,
        overtimeMinutes: 0
      };
      days[day].isOnLeave = leaveInfo.isOnLeave;
      days[day].leaveType = leaveInfo.leaveType;
      days[day].leaveDuration = leaveInfo.leaveDuration;
      days[day].leaveHalfDaySession = leaveInfo.leaveHalfDaySession;
      days[day].leaveUnits = leaveInfo.leaveUnits;
      if (
        leaveInfo.isOnLeave
        && leaveInfo.leaveDuration === "half_day"
        && days[day].status === "pending_checkout"
      ) {
        days[day].excludeFromPayroll = false;
        days[day].payrollReconciledByLeave = true;
      }
      days[day].isWeekOff = isWeekOff;
      days[day].holidayName = holidayName;
    }
    return {
      employeeId: emp._id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      employeeCode: emp.employeeCode,
      days
    };
  });

  return { year, month, daysInMonth, employees: data };
};

exports.getMyAttendanceMatrix = async (req) => {
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const { year, month, start, end, daysInMonth } = parseMonthRangeInTimeZone(
    req.query.month,
    organizationTimeZone
  );
  const employee = await getEmployeeFromReq(req);

  const [attendanceRows, holidays, approvedLeaves, weekOffDays, orgSettings] = await Promise.all([
    Attendance.find({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      date: { $gte: start, $lte: end }
    })
      .select("date checkInAt checkOutAt totalMinutes overriddenBy overriddenAt shiftName shiftCode shiftStartTime shiftEndTime lateByMinutes earlyLoginByMinutes earlyCheckoutByMinutes overtimeMinutes missedCheckout missedCheckoutMarkedAt")
      .populate("overriddenBy", "firstName lastName"),
    Holiday.find({
      organizationId: req.user.organizationId,
      status: "active",
      date: { $gte: start, $lte: end }
    }).select("date name"),
    Leave.find({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      status: "approved",
      fromDate: { $lte: end },
      toDate: { $gte: start }
    }).populate("leaveTypeId", "name"),
    WeekOffService.resolveWeekOffDays({
      organizationId: req.user.organizationId,
      shiftId: employee.shiftId
    }),
    OrgSettings.findOne({ organizationId: req.user.organizationId }).select("minHalfDayHours minWorkHoursPerDay")
  ]);

  const holidayByDay = new Map();
  holidays.forEach((h) => {
    holidayByDay.set(getDayInTimeZone(h.date, organizationTimeZone), h.name);
  });

  const days = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days[day] = {
      status: "absent",
      checkInAt: null,
      checkOutAt: null,
      isOpenSession: false,
      excludeFromPayroll: false,
      payrollReconciledByLeave: false,
      missedCheckout: false,
      missedCheckoutMarkedAt: null,
      overriddenBy: null,
      overriddenAt: null,
      shiftName: null,
      shiftCode: null,
      shiftStartTime: null,
      shiftEndTime: null,
      lateByMinutes: 0,
      earlyLoginByMinutes: 0,
      earlyCheckoutByMinutes: 0,
      overtimeMinutes: 0,
      isOnLeave: false,
      leaveType: null,
      leaveDuration: null,
      leaveHalfDaySession: null,
      leaveUnits: 0,
      isWeekOff: weekOffDays.includes(getWeekdayForDateKey(dateKey, organizationTimeZone)),
      holidayName: holidayByDay.get(day) || null
    };
  }
  attendanceRows.forEach((row) => {
    const day = getDayInTimeZone(row.date, organizationTimeZone);
    const overriddenByName = row.overriddenBy
      ? `${row.overriddenBy.firstName || ""} ${row.overriddenBy.lastName || ""}`.trim()
      : null;
    const isOpenSession = Boolean(row.checkInAt && !row.checkOutAt);
    const status = resolveAttendanceMatrixStatus(row, {
      minHalfDayHours: Number(orgSettings?.minHalfDayHours ?? 4),
      minWorkHoursPerDay: Number(orgSettings?.minWorkHoursPerDay ?? 8)
    });
    days[day] = {
      ...days[day],
      status,
      checkInAt: row.checkInAt || null,
      checkOutAt: row.checkOutAt || null,
      totalMinutes: Number(row.totalMinutes || 0),
      isOpenSession,
      excludeFromPayroll: isOpenSession,
      payrollReconciledByLeave: false,
      missedCheckout: Boolean(row.missedCheckout),
      missedCheckoutMarkedAt: row.missedCheckoutMarkedAt || null,
      overriddenBy: overriddenByName || null,
      overriddenAt: row.overriddenAt || null,
      shiftName: row.shiftName || null,
      shiftCode: row.shiftCode || null,
      shiftStartTime: row.shiftStartTime || null,
      shiftEndTime: row.shiftEndTime || null,
      lateByMinutes: Number(row.lateByMinutes || 0),
      earlyLoginByMinutes: Number(row.earlyLoginByMinutes || 0),
      earlyCheckoutByMinutes: Number(row.earlyCheckoutByMinutes || 0),
      overtimeMinutes: Number(row.overtimeMinutes || 0)
    };
  });

  approvedLeaves.forEach((leave) => {
    const leaveStart = new Date(leave.fromDate) < start ? start : new Date(leave.fromDate);
    const leaveEnd = new Date(leave.toDate) > end ? end : new Date(leave.toDate);
    eachDateBetween(leaveStart, leaveEnd).forEach((d) => {
      const day = getDayInTimeZone(d, organizationTimeZone);
      days[day] = {
        ...days[day],
        isOnLeave: true,
        leaveType: leave.leaveTypeId?.name || "Leave",
        leaveDuration: leave.duration || "full_day",
        leaveHalfDaySession: leave.halfDaySession || null,
        leaveUnits: leave.duration === "half_day" ? 0.5 : 1
      };
      if (
        days[day].leaveDuration === "half_day"
        && days[day].status === "pending_checkout"
      ) {
        days[day].excludeFromPayroll = false;
        days[day].payrollReconciledByLeave = true;
      }
    });
  });

  return {
    year,
    month,
    daysInMonth,
    employees: [{
      employeeId: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeCode: employee.employeeCode,
      days
    }]
  };
};

exports.getAttendanceCellHistory = async (req) => {
  const employeeId = req.query.employeeId;
  const date = req.query.date;
  if (!employeeId || !date) {
    throw new Error("employeeId and date are required");
  }

  await assertManageAccessForEmployee(req, employeeId);

  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const day = startOfDayInTimeZone(date, organizationTimeZone);
  const attendance = await Attendance.findOne({
    organizationId: req.user.organizationId,
    employeeId,
    date: day
  }).populate("overriddenBy", "firstName lastName employeeCode");

  if (!attendance) {
    return { attendance: null, history: [] };
  }

  const history = await AuditLog.find({
    organizationId: req.user.organizationId,
    module: "timesheets",
    entityId: attendance._id,
    action: { $in: ["CHECK_IN", "CHECK_OUT", "ATTENDANCE_OVERRIDE"] }
  })
    .populate("userId", "email")
    .sort({ createdAt: -1 })
    .select("action before after createdAt userId");

  return {
    attendance,
    history: history.map((h) => ({
      action: h.action,
      createdAt: h.createdAt,
      actor: h.userId?.email || "Unknown",
      before: h.before || null,
      after: h.after || null
    }))
  };
};

exports.getMyAttendanceCellHistory = async (req) => {
  const employee = await getEmployeeFromReq(req);
  req.query.employeeId = employee._id.toString();
  return exports.getAttendanceCellHistory(req);
};

exports.raiseAttendanceRequest = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const date = startOfDayInTimeZone(req.body.date, organizationTimeZone);
  const today = startOfDayInTimeZone(new Date(), organizationTimeZone);
  if (date > today) {
    throw new Error("Attendance request date cannot be in the future");
  }

  const requestType = req.body.requestType;
  const requestedCheckInTime = req.body.requestedCheckInTime || null;
  const requestedCheckOutTime = req.body.requestedCheckOutTime || null;

  if (requestType === "missed_checkout" && !requestedCheckOutTime) {
    throw new Error("Requested checkout time is required for missed checkout request");
  }
  if (requestType === "correction" && !requestedCheckInTime && !requestedCheckOutTime) {
    throw new Error("Provide requested check-in or check-out time");
  }

  if (requestType === "missed_checkout") {
    const attendance = await Attendance.findOne({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      date
    }).select("checkInAt checkOutAt");

    if (!attendance?.checkInAt) {
      throw new Error("No check-in found for this date");
    }

    if (attendance.checkOutAt) {
      throw new Error("Checkout already exists for this date");
    }
  }

  const existingPending = await AttendanceRequest.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date,
    status: "pending"
  });
  if (existingPending) {
    throw new Error("A pending attendance request already exists for this date");
  }

  const flowConfig = await resolveApplicableFlow({
    organizationId: req.user.organizationId,
    moduleKey: "attendance_request",
    subjectEmployee: employee
  });
  const initialPendingStep = (flowConfig?.steps || []).find((s) => s.status === "pending");

  const request = await AttendanceRequest.create({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date,
    requestType,
    requestedCheckInTime,
    requestedCheckOutTime,
    reason: req.body.reason,
    status: "pending",
    approvalFlowId: flowConfig?.flowId || null,
    approvalSteps: flowConfig?.steps || [],
    currentApprovalStep: initialPendingStep?.stepNumber || null
  });

  const pendingStep = getCurrentPendingStep(request.approvalSteps || []);
  if (pendingStep) {
    const employeeName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
    await notifyAttendanceApprovalStepAssignees({
      organizationId: req.user.organizationId,
      step: pendingStep,
      actorEmployeeId: employee._id,
      type: "attendance_request_pending_approval",
      title: "Attendance request approval pending",
      message: `${employeeName} submitted an attendance request for ${date.toDateString()}.`,
      meta: {
        attendanceRequestId: request._id,
        status: request.status,
        currentApprovalStep: request.currentApprovalStep
      }
    });
  }

  return request;
};

exports.getMyAttendanceRequests = async (req) => {
  const employee = await getEmployeeFromReq(req);
  return AttendanceRequest.find({
    organizationId: req.user.organizationId,
    employeeId: employee._id
  })
    .populate("approvalSteps.approverEmployeeId", "firstName lastName employeeCode")
    .populate("approvalSteps.actionBy", "firstName lastName employeeCode")
    .sort({ createdAt: -1 });
};

exports.getAttendanceRequests = async (req) => {
  const query = {
    organizationId: req.user.organizationId
  };

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        const reportIds = await Employee.find({
          organizationId: req.user.organizationId,
          managerId: managerEmployee._id
        }).distinct("_id");
        query.employeeId = { $in: reportIds };
      }
    }
  }

  return AttendanceRequest.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .populate("actionBy", "firstName lastName employeeCode")
    .populate("approvalSteps.approverEmployeeId", "firstName lastName employeeCode")
    .populate("approvalSteps.actionBy", "firstName lastName employeeCode")
    .sort({ createdAt: -1 });
};

exports.getMyPendingAttendanceApprovals = async (req) => {
  const actorRoleSlug = await getActorRoleSlug(req);
  if (!REQUEST_APPROVER_ROLE_SLUGS.has(actorRoleSlug)) {
    return [];
  }

  const query = {
    organizationId: req.user.organizationId,
    status: "pending"
  };

  if (actorRoleSlug === "manager") {
    const managerEmployee = await Employee.findOne({
      userId: req.user.userId,
      organizationId: req.user.organizationId
    }).select("_id");

    if (!managerEmployee) {
      return [];
    }

    const reportIds = await Employee.find({
      organizationId: req.user.organizationId,
      managerId: managerEmployee._id
    }).distinct("_id");
    query.employeeId = { $in: reportIds };
  }

  const rows = await AttendanceRequest.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .populate("actionBy", "firstName lastName employeeCode")
    .populate("approvalSteps.approverEmployeeId", "firstName lastName employeeCode")
    .populate("approvalSteps.actionBy", "firstName lastName employeeCode")
    .sort({ createdAt: -1 });

  return rows;
};

exports.actionAttendanceRequest = async (req) => {
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const request = await AttendanceRequest.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });
  if (!request) throw new Error("Attendance request not found");
  if (request.status !== "pending") throw new Error("Attendance request already actioned");

  const actorRoleSlug = await getActorRoleSlug(req);
  if (!REQUEST_APPROVER_ROLE_SLUGS.has(actorRoleSlug)) {
    throw new Error("Only reporting manager, HR, or admin can action requests");
  }

  await assertManageAccessForEmployee(req, request.employeeId);

  const actorEmployee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  }).select("_id");
  const actorContext = await getActorApprovalContext(req);
  let finalStatusToApply = req.body.status;
  let isIntermediateApproval = false;

  if (
    ["approved", "rejected"].includes(req.body.status)
    && Array.isArray(request.approvalSteps)
    && request.approvalSteps.length
  ) {
    const currentStep = getCurrentPendingStep(request.approvalSteps || []);
    if (!currentStep) {
      throw new Error("No pending approval step found");
    }

    const allowedByFlow = canActorApproveStep(currentStep, actorContext);
    if (allowedByFlow) {
      const progress = advanceApprovalSteps({
        steps: request.approvalSteps || [],
        action: req.body.status,
        actionBy: actorEmployee?._id || null,
        remarks: req.body.status === "rejected" ? req.body.rejectionReason || "" : null
      });
      request.approvalSteps = progress.steps;
      request.currentApprovalStep = progress.currentApprovalStep;
      finalStatusToApply = progress.finalStatus;
      isIntermediateApproval = progress.isIntermediateApproval;
    } else {
      // Privileged override: reporting manager/HR/admin can finalize request even if flow step mismatches.
      const overrideStatus = req.body.status === "approved" ? "approved" : "rejected";
      const actionAt = new Date();
      request.approvalSteps = (request.approvalSteps || []).map((step) => {
        if (step.status === "approved" || step.status === "rejected") return step;
        return {
          ...step,
          status: overrideStatus,
          actionBy: actorEmployee?._id || null,
          actionAt,
          remarks: req.body.status === "rejected" ? req.body.rejectionReason || "" : "Approved by authorized approver"
        };
      });
      request.currentApprovalStep = null;
      finalStatusToApply = req.body.status;
      isIntermediateApproval = false;
    }
  }

  if (finalStatusToApply === "rejected") {
    request.status = "rejected";
    request.rejectionReason = req.body.rejectionReason;
    request.actionBy = actorEmployee?._id || null;
    request.actionAt = new Date();
    await request.save();
    return request;
  }

  if (isIntermediateApproval) {
    request.status = "pending";
    request.actionBy = actorEmployee?._id || null;
    request.actionAt = new Date();
    await request.save();
    const requestEmployee = await Employee.findById(request.employeeId).select("firstName lastName");
    const pendingStep = getCurrentPendingStep(request.approvalSteps || []);
    await notifyAttendanceApprovalStepAssignees({
      organizationId: request.organizationId,
      step: pendingStep,
      actorEmployeeId: actorEmployee?._id || null,
      type: "attendance_request_pending_approval",
      title: "Attendance request approval pending",
      message: `${requestEmployee?.firstName || "Employee"} ${requestEmployee?.lastName || ""}`.trim()
        + " attendance request is waiting for your approval.",
      meta: {
        attendanceRequestId: request._id,
        status: request.status,
        currentApprovalStep: request.currentApprovalStep
      }
    });
    return request;
  }

  const attendanceDate = startOfDayInTimeZone(request.date, organizationTimeZone);
  const attendanceDateKey = toDateKeyInTimeZone(attendanceDate, organizationTimeZone);
  const attendance = await Attendance.findOneAndUpdate(
    {
      organizationId: req.user.organizationId,
      employeeId: request.employeeId,
      date: attendanceDate
    },
    {
      $setOnInsert: {
        organizationId: req.user.organizationId,
        employeeId: request.employeeId,
        date: attendanceDate
      }
    },
    { upsert: true, new: true }
  );

  const existingCheckIn = attendance.checkInAt;
  const existingCheckOut = attendance.checkOutAt;

  let checkInAt = existingCheckIn;
  let checkOutAt = existingCheckOut;

  if (request.requestedCheckInTime) {
    checkInAt = zonedDateTimeToUtc(attendanceDateKey, request.requestedCheckInTime, organizationTimeZone);
  }
  if (request.requestedCheckOutTime) {
    checkOutAt = zonedDateTimeToUtc(attendanceDateKey, request.requestedCheckOutTime, organizationTimeZone);
  }

  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
    const nextDay = new Date(checkOutAt);
    nextDay.setDate(nextDay.getDate() + 1);
    checkOutAt = nextDay;
  }

  const { shift, scheduledStartAt, scheduledEndAt } = await resolveShiftSchedule(
    req.user.organizationId,
    request.employeeId,
    attendanceDateKey,
    organizationTimeZone
  );

  const lateByMinutes = checkInAt
    ? Math.max(
        0,
        Math.round((checkInAt.getTime() - scheduledStartAt.getTime()) / 60000) - Number(shift.graceMinutes || 0)
      )
    : 0;
  const earlyLoginByMinutes = checkInAt
    ? Math.max(0, Math.round((scheduledStartAt.getTime() - checkInAt.getTime()) / 60000))
    : 0;
  const earlyCheckoutByMinutes = checkOutAt
    ? Math.max(0, Math.round((scheduledEndAt.getTime() - checkOutAt.getTime()) / 60000))
    : 0;
  const overtimeMinutes = checkOutAt
    ? Math.max(0, Math.round((checkOutAt.getTime() - scheduledEndAt.getTime()) / 60000))
    : 0;

  const totalMinutes =
    checkInAt && checkOutAt
      ? Math.max(0, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000))
      : 0;

  attendance.checkInAt = checkInAt || null;
  attendance.checkOutAt = checkOutAt || null;
  attendance.totalMinutes = totalMinutes;
  attendance.status = checkInAt && checkOutAt ? "checked_out" : "checked_in";
  attendance.overriddenBy = actorEmployee?._id || null;
  attendance.overriddenAt = new Date();
  attendance.shiftId = shift._id || null;
  attendance.shiftName = shift.name;
  attendance.shiftCode = shift.code;
  attendance.shiftStartTime = shift.startTime;
  attendance.shiftEndTime = shift.endTime;
  attendance.scheduledStartAt = scheduledStartAt;
  attendance.scheduledEndAt = scheduledEndAt;
  attendance.lateByMinutes = lateByMinutes;
  attendance.earlyLoginByMinutes = earlyLoginByMinutes;
  attendance.earlyCheckoutByMinutes = earlyCheckoutByMinutes;
  attendance.overtimeMinutes = overtimeMinutes;
  attendance.missedCheckout = Boolean(checkInAt && !checkOutAt);
  attendance.missedCheckoutMarkedAt = checkInAt && !checkOutAt ? (attendance.missedCheckoutMarkedAt || new Date()) : null;
  if (request.requestType === "missed_checkout" && checkOutAt) {
    attendance.missedCheckout = false;
    attendance.missedCheckoutMarkedAt = null;
    attendance.missedCheckoutResolvedRequestId = request._id;
  }
  await attendance.save();

  if (checkInAt && checkOutAt) {
    const hoursWorked = Number((totalMinutes / 60).toFixed(2));
    await upsertTimesheetHours({
      organizationId: req.user.organizationId,
      employeeId: request.employeeId,
      dateValue: attendanceDate,
      hoursWorked
    });
  }

  request.status = "approved";
  request.rejectionReason = null;
  request.actionBy = actorEmployee?._id || null;
  request.actionAt = new Date();
  request.resolvedAttendanceId = attendance._id;
  await request.save();

  return request;
};

exports.overrideAttendance = async (req) => {
  const actorEmployee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  }).select("_id");

  const employee = await Employee.findOne({
    _id: req.params.employeeId,
    organizationId: req.user.organizationId
  }).select("_id");

  if (!employee) {
    throw new Error("Employee not found");
  }

  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const date = startOfDayInTimeZone(req.body.date, organizationTimeZone);
  const dateKey = toDateKeyInTimeZone(date, organizationTimeZone);
  await assertManageAccessForEmployee(req, employee._id);
  await validateAttendanceEditWindow(req.user.organizationId, date, organizationTimeZone);
  const status = req.body.status;
  const { shift, scheduledStartAt, scheduledEndAt } = await resolveShiftSchedule(
    req.user.organizationId,
    employee._id,
    dateKey,
    organizationTimeZone
  );
  const defaultCheckIn = new Date(scheduledStartAt);
  const defaultCheckOut = new Date(scheduledEndAt);
  const shiftMinutes = Math.max(
    0,
    Math.round((defaultCheckOut.getTime() - defaultCheckIn.getTime()) / 60000)
  );

  const update = status === "present"
    ? {
      checkInAt: defaultCheckIn,
      checkOutAt: defaultCheckOut,
      totalMinutes: shiftMinutes,
      status: "checked_out",
      overriddenBy: actorEmployee?._id || null,
      overriddenAt: new Date(),
      shiftId: shift._id || null,
      shiftName: shift.name,
      shiftCode: shift.code,
      shiftStartTime: shift.startTime,
      shiftEndTime: shift.endTime,
      scheduledStartAt,
      scheduledEndAt,
      lateByMinutes: 0,
      earlyLoginByMinutes: 0,
      earlyCheckoutByMinutes: 0,
      overtimeMinutes: 0,
      missedCheckout: false,
      missedCheckoutMarkedAt: null,
      missedCheckoutResolvedRequestId: null
    }
    : {
      checkInAt: null,
      checkOutAt: null,
      totalMinutes: 0,
      status: "checked_out",
      overriddenBy: actorEmployee?._id || null,
      overriddenAt: new Date(),
      shiftId: shift._id || null,
      shiftName: shift.name,
      shiftCode: shift.code,
      shiftStartTime: shift.startTime,
      shiftEndTime: shift.endTime,
      scheduledStartAt,
      scheduledEndAt,
      lateByMinutes: 0,
      earlyLoginByMinutes: 0,
      earlyCheckoutByMinutes: 0,
      overtimeMinutes: 0,
      missedCheckout: false,
      missedCheckoutMarkedAt: null,
      missedCheckoutResolvedRequestId: null
    };

  const attendance = await Attendance.findOneAndUpdate(
    {
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      date
    },
    {
      $set: update,
      $setOnInsert: {
        organizationId: req.user.organizationId,
        employeeId: employee._id,
        date
      }
    },
    { upsert: true, new: true }
  );

  const hoursWorked = status === "present"
    ? Number((shiftMinutes / 60).toFixed(2))
    : 0;
  await upsertTimesheetHours({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    dateValue: date,
    hoursWorked
  });

  await audit({
    req,
    module: "timesheets",
    action: "ATTENDANCE_OVERRIDE",
    entityId: attendance._id,
    after: attendance.toObject()
  });

  const employeeWithUser = await Employee.findById(employee._id).populate("userId", "email");
  if (employeeWithUser?.userId?.email) {
    await sendNotification({
      toEmail: employeeWithUser.userId.email,
      toName: employeeWithUser.firstName,
      subject: "Attendance Updated",
      message: `Your attendance for ${date.toDateString()} has been marked as ${status}.`
    });
  }
  if (employeeWithUser?.userId?._id) {
    await createNotificationSafe({
      organizationId: req.user.organizationId,
      recipientUserId: employeeWithUser.userId._id,
      recipientEmployeeId: employeeWithUser._id,
      actorEmployeeId: actorEmployee?._id || null,
      type: "attendance_override",
      title: "Attendance updated",
      message: `Your attendance for ${date.toDateString()} was overridden to ${status}.`,
        meta: {
        date: dateKey,
        status
      }
    });
  }

  return attendance;
};

exports.bulkOverrideAttendance = async (req) => {
  const actorEmployee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  }).select("_id");

  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const date = startOfDayInTimeZone(req.body.date, organizationTimeZone);
  const dateKey = toDateKeyInTimeZone(date, organizationTimeZone);
  await validateAttendanceEditWindow(req.user.organizationId, date, organizationTimeZone);

  const employeeIds = req.body.employeeIds || [];
  let updatedCount = 0;

  for (const empId of employeeIds) {
    const employee = await Employee.findOne({
      _id: empId,
      organizationId: req.user.organizationId
    }).select("_id");
    if (!employee) continue;

    await assertManageAccessForEmployee(req, employee._id);
    const { shift, scheduledStartAt, scheduledEndAt } = await resolveShiftSchedule(
      req.user.organizationId,
      employee._id,
      dateKey,
      organizationTimeZone
    );
    const defaultCheckIn = new Date(scheduledStartAt);
    const defaultCheckOut = new Date(scheduledEndAt);
    const shiftMinutes = Math.max(
      0,
      Math.round((defaultCheckOut.getTime() - defaultCheckIn.getTime()) / 60000)
    );

    const update = req.body.status === "present"
      ? {
        checkInAt: defaultCheckIn,
        checkOutAt: defaultCheckOut,
        totalMinutes: shiftMinutes,
        status: "checked_out",
        overriddenBy: actorEmployee?._id || null,
        overriddenAt: new Date(),
        shiftId: shift._id || null,
        shiftName: shift.name,
        shiftCode: shift.code,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        scheduledStartAt,
        scheduledEndAt,
        lateByMinutes: 0,
        earlyLoginByMinutes: 0,
        earlyCheckoutByMinutes: 0,
        overtimeMinutes: 0,
        missedCheckout: false,
        missedCheckoutMarkedAt: null,
        missedCheckoutResolvedRequestId: null
      }
      : {
        checkInAt: null,
        checkOutAt: null,
        totalMinutes: 0,
        status: "checked_out",
        overriddenBy: actorEmployee?._id || null,
        overriddenAt: new Date(),
        shiftId: shift._id || null,
        shiftName: shift.name,
        shiftCode: shift.code,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        scheduledStartAt,
        scheduledEndAt,
        lateByMinutes: 0,
        earlyLoginByMinutes: 0,
        earlyCheckoutByMinutes: 0,
        overtimeMinutes: 0,
        missedCheckout: false,
        missedCheckoutMarkedAt: null,
        missedCheckoutResolvedRequestId: null
      };

    const attendance = await Attendance.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        employeeId: employee._id,
        date
      },
      {
        $set: update,
        $setOnInsert: {
          organizationId: req.user.organizationId,
          employeeId: employee._id,
          date
        }
      },
      { upsert: true, new: true }
    );

    const hoursWorked = req.body.status === "present"
      ? Number((shiftMinutes / 60).toFixed(2))
      : 0;
    await upsertTimesheetHours({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      dateValue: date,
      hoursWorked
    });

    await audit({
      req,
      module: "timesheets",
      action: "ATTENDANCE_OVERRIDE",
      entityId: attendance._id,
      after: attendance.toObject()
    });

    const employeeWithUser = await Employee.findById(employee._id).populate("userId", "email");
    if (employeeWithUser?.userId?.email) {
      await sendNotification({
        toEmail: employeeWithUser.userId.email,
        toName: employeeWithUser.firstName,
        subject: "Attendance Updated",
        message: `Your attendance for ${date.toDateString()} has been marked as ${req.body.status}.`
      });
    }
    if (employeeWithUser?.userId?._id) {
      await createNotificationSafe({
        organizationId: req.user.organizationId,
        recipientUserId: employeeWithUser.userId._id,
        recipientEmployeeId: employeeWithUser._id,
        actorEmployeeId: actorEmployee?._id || null,
        type: "attendance_override",
        title: "Attendance updated",
        message: `Your attendance for ${date.toDateString()} was overridden to ${req.body.status}.`,
        meta: {
          date: dateKey,
          status: req.body.status
        }
      });
    }
    updatedCount += 1;
  }

  return {
    updatedCount,
    date,
    status: req.body.status
  };
};

exports.getOnline = async (req) => {
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const now = new Date();
  const yesterdayStart = startOfDayInTimeZone(
    addDaysToDateKey(toDateKeyInTimeZone(now, organizationTimeZone), -1),
    organizationTimeZone
  );
  const todayKey = toDateKeyInTimeZone(now, organizationTimeZone);
  const yesterdayKey = addDaysToDateKey(todayKey, -1);

  const query = {
    organizationId: req.user.organizationId,
    checkInAt: { $ne: null, $lte: now },
    checkOutAt: null,
    date: { $gte: yesterdayStart }
  };

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        const reportIds = await Employee.find({
          organizationId: req.user.organizationId,
          managerId: managerEmployee._id
        }).distinct("_id");
        query.employeeId = { $in: reportIds };
      }
    }
  }

  const rows = await Attendance.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .sort({ checkInAt: -1 });

  return rows.filter((row) => {
    const attendanceDateKey = toDateKeyInTimeZone(row.date, organizationTimeZone);
    const scheduledEndAt = row.scheduledEndAt ? new Date(row.scheduledEndAt) : endOfDayInTimeZone(row.date, organizationTimeZone);

    if (now > scheduledEndAt) return false;

    if (attendanceDateKey === todayKey) return true;

    if (attendanceDateKey === yesterdayKey && row.scheduledEndAt) {
      return now <= scheduledEndAt;
    }

    return false;
  });
};

exports.getOnLeave = async (req) => {
  const organizationTimeZone = await getOrganizationTimeZone(req.user.organizationId);
  const todayStart = startOfDayInTimeZone(new Date(), organizationTimeZone);
  const todayEnd = endOfDayInTimeZone(new Date(), organizationTimeZone);

  const query = {
    organizationId: req.user.organizationId,
    status: "approved",
    fromDate: { $lte: todayEnd },
    toDate: { $gte: todayStart }
  };

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        const reportIds = await Employee.find({
          organizationId: req.user.organizationId,
          managerId: managerEmployee._id
        }).distinct("_id");
        query.employeeId = { $in: reportIds };
      }
    }
  }

  return Leave.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .populate("leaveTypeId", "name code")
    .sort({ fromDate: 1 });
};

exports.createWeekly = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const baseDate = req.body.weekStart || new Date();
  const weekStart = getWeekStart(baseDate);
  const weekEnd = getWeekEnd(weekStart);

  const exists = await Timesheet.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    weekStart
  });

  if (exists) {
    throw new Error("Timesheet already exists for this week");
  }

  const entries = sanitizeEntries(req.body.entries || [], weekStart);
  const totalHours = calculateTotalHours(entries);  
  const timesheet = await Timesheet.create({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    weekStart,
    weekEnd,
    entries,
    totalHours,
    status: "draft"
  });

  await audit({
    req,
    module: "timesheets",
    action: "CREATE",
    entityId: timesheet._id,
    after: timesheet.toObject()
  });

  return timesheet;
};

exports.updateWeekly = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const timesheet = await Timesheet.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
    employeeId: employee._id
  });

  if (!timesheet) throw new Error("Timesheet not found");

  if (!["draft", "rejected"].includes(timesheet.status)) {
    throw new Error("Timesheet is locked after submission");
  }

  ensureEntriesInWeek(req.body.entries || [], timesheet.weekStart, timesheet.weekEnd);
  const entries = sanitizeEntries(req.body.entries || [], timesheet.weekStart);
  await validateHours(req, entries);
  timesheet.entries = entries;
  timesheet.totalHours = calculateTotalHours(entries);

  await timesheet.save();

  await audit({
    req,
    module: "timesheets",
    action: "UPDATE",
    entityId: timesheet._id,
    after: timesheet.toObject()
  });

  return timesheet;
};

exports.submitWeekly = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const timesheet = await Timesheet.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
    employeeId: employee._id
  });

  if (!timesheet) throw new Error("Timesheet not found");

  const now = new Date();
  const tsStart = new Date(timesheet.weekStart);
  if (
    tsStart.getFullYear() !== now.getFullYear() ||
    tsStart.getMonth() !== now.getMonth()
  ) {
    throw new Error("Timesheet submission allowed only for current month");
  }

  if (!["draft", "rejected"].includes(timesheet.status)) {
    throw new Error("Timesheet already submitted");
  }

  if (Array.isArray(req.body.entries)) {
    ensureEntriesInWeek(req.body.entries, timesheet.weekStart, timesheet.weekEnd);
    const entries = sanitizeEntries(req.body.entries, timesheet.weekStart);
    await validateHours(req, entries);
    timesheet.entries = entries;
    timesheet.totalHours = calculateTotalHours(entries);
  } else {
    await validateHours(req, timesheet.entries);
  }
  timesheet.status = "submitted";
  timesheet.submittedAt = new Date();
  await timesheet.save();

  await audit({
    req,
    module: "timesheets",
    action: "SUBMIT",
    entityId: timesheet._id,
    after: timesheet.toObject()
  });

  return timesheet;
};

exports.getMyWeekly = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const weekStartQuery = req.query.weekStart;

  if (weekStartQuery) {
    const weekStart = getWeekStart(weekStartQuery);
    return Timesheet.findOne({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      weekStart
    }).populate("employeeId", "firstName lastName employeeCode");
  }

  return Timesheet.find({
    organizationId: req.user.organizationId,
    employeeId: employee._id
  })
    .populate("employeeId", "firstName lastName employeeCode")
    .sort({ weekStart: -1 });
};

exports.getAllWeekly = async (req) => {
  const query = { organizationId: req.user.organizationId };

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        const reportIds = await Employee.find({
          organizationId: req.user.organizationId,
          managerId: managerEmployee._id
        }).distinct("_id");
        query.employeeId = { $in: reportIds };
      }
    }
  }

  return Timesheet.find(query)
    .populate("employeeId", "firstName lastName employeeCode")
    .sort({ weekStart: -1 });
};

exports.actionWeekly = async (req) => {
  const timesheet = await Timesheet.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });

  if (!timesheet) throw new Error("Timesheet not found");

  if (timesheet.status !== "submitted") {
    throw new Error("Only submitted timesheets can be actioned");
  }

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        const reportIds = await Employee.find({
          organizationId: req.user.organizationId,
          managerId: managerEmployee._id
        }).distinct("_id");
        const isReport = reportIds.some(
          (id) => id.toString() === timesheet.employeeId.toString()
        );
        if (!isReport) {
          throw new Error("Access denied");
        }
      }
    }
  }

  const actor = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  if (req.body.status === "approved") {
    timesheet.status = "approved";
    timesheet.rejectionReason = undefined;
  } else if (req.body.status === "rejected") {
    timesheet.status = "rejected";
    timesheet.rejectionReason = req.body.rejectionReason;
  } else {
    throw new Error("Invalid timesheet action");
  }

  timesheet.actionBy = actor?._id;
  timesheet.actionAt = new Date();

  await timesheet.save();

  await audit({
    req,
    module: "timesheets",
    action: "ACTION",
    entityId: timesheet._id,
    after: timesheet.toObject()
  });

  return timesheet;
};

exports.recallWeekly = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const timesheet = await Timesheet.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
    employeeId: employee._id
  });

  if (!timesheet) throw new Error("Timesheet not found");

  if (timesheet.status !== "approved") {
    throw new Error("Only approved timesheets can be recalled");
  }

  const lastWeekStart = getWeekStart(new Date());
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  if (toDateKey(timesheet.weekStart) !== toDateKey(lastWeekStart)) {
    throw new Error("Only last week timesheet can be recalled");
  }

  timesheet.status = "draft";
  timesheet.actionBy = undefined;
  timesheet.actionAt = undefined;
  await timesheet.save();

  await audit({
    req,
    module: "timesheets",
    action: "RECALL",
    entityId: timesheet._id,
    after: timesheet.toObject()
  });

  return timesheet;
};
