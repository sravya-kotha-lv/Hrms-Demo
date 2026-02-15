const Timesheet = require("./timesheet.model");
const Attendance = require("./timesheetAttendance.model");
const AttendanceRequest = require("./attendanceRequest.model");
const Employee = require("../employees/employee.model");
const Leave = require("../leaves/leave.model");
const { audit } = require("../auditLogs/auditLogs.service");
const Role = require("../roles/role.model");
const OrgSettings = require("../orgSettings/orgSettings.model");
const WeekOff = require("../weekOffs/weekOff.model");
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

const resolveShiftSchedule = async (organizationId, employeeId, dateValue) => {
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
  const startMinutes = parseTimeToMinutes(effectiveShift.startTime);
  const endMinutes = parseTimeToMinutes(effectiveShift.endTime);

  const scheduledStartAt = buildScheduledDateTime(dateValue, startMinutes);
  let scheduledEndAt = buildScheduledDateTime(dateValue, endMinutes);

  // Overnight shift support, e.g. 22:00 -> 06:00
  if (endMinutes <= startMinutes) {
    scheduledEndAt.setDate(scheduledEndAt.getDate() + 1);
  }

  return {
    shift: effectiveShift,
    scheduledStartAt,
    scheduledEndAt
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

const validateAttendanceEditWindow = async (organizationId, dateValue) => {
  const settings = await OrgSettings.findOne({ organizationId })
    .select("attendanceLockEnabled attendanceLockAfterDays attendanceLockMode payrollCutoffDay");

  if (!settings?.attendanceLockEnabled) return;

  const target = startOfDay(dateValue);
  const today = startOfDay(new Date());
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
  const currentDay = today.getDate();
  let periodStart;
  if (currentDay > cutoffDay) {
    periodStart = new Date(today.getFullYear(), today.getMonth(), cutoffDay + 1);
  } else {
    periodStart = new Date(today.getFullYear(), today.getMonth() - 1, cutoffDay + 1);
  }
  periodStart = startOfDay(periodStart);

  if (target < periodStart) {
    throw new Error(`Attendance is locked before payroll period start ${periodStart.toDateString()}`);
  }
};

exports.checkIn = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const now = new Date();
  const today = startOfDay(now);
  const { shift, scheduledStartAt, scheduledEndAt } = await resolveShiftSchedule(
    req.user.organizationId,
    employee._id,
    today
  );

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
    throw new Error("Already checked in. If you missed checkout, please raise an attendance request.");
  }

  const existing = await Attendance.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: today
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
    await existing.save();
    return existing;
  }

  const attendance = await Attendance.create({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: today,
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
    overtimeMinutes: 0
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
    : (await resolveShiftSchedule(req.user.organizationId, employee._id, today)).scheduledEndAt;
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
  const queryDate = req.query.date ? new Date(req.query.date) : new Date();
  const dayStart = startOfDay(queryDate);
  const dayEnd = endOfDay(queryDate);

  return Attendance.find({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: { $gte: dayStart, $lte: dayEnd }
  }).sort({ date: -1 });
};

exports.getAttendance = async (req) => {
  const start = req.query.startDate ? new Date(req.query.startDate) : new Date();
  const end = req.query.endDate ? new Date(req.query.endDate) : start;

  const startDate = startOfDay(start);
  const endDate = endOfDay(end);

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
  const { year, month, start, end, daysInMonth } = parseMonthRange(req.query.month);

  const employeeQuery = {
    organizationId: req.user.organizationId,
    status: "active"
  };

  const scopedEmployeeIds = await getScopedEmployeeIdsForViewer(req);
  if (Array.isArray(scopedEmployeeIds)) {
    employeeQuery._id = { $in: scopedEmployeeIds };
  }

  const employees = await Employee.find(employeeQuery)
    .select("_id firstName lastName employeeCode")
    .sort({ firstName: 1, lastName: 1 });

  if (!employees.length) {
    return { year, month, daysInMonth, employees: [] };
  }

  const employeeIds = employees.map((e) => e._id);
  const [attendanceRows, weekOffConfig, holidays, approvedLeaves] = await Promise.all([
    Attendance.find({
      organizationId: req.user.organizationId,
      employeeId: { $in: employeeIds },
      date: { $gte: start, $lte: end }
    })
      .select("employeeId date checkInAt checkOutAt overriddenBy overriddenAt shiftName shiftCode shiftStartTime shiftEndTime lateByMinutes earlyLoginByMinutes earlyCheckoutByMinutes overtimeMinutes")
      .populate("overriddenBy", "firstName lastName"),
    WeekOff.findOne({ organizationId: req.user.organizationId }).select("weekOffDays"),
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
    }).populate("leaveTypeId", "name")
  ]);

  const weekOffDays = weekOffConfig?.weekOffDays || [];
  const holidayByDay = new Map();
  holidays.forEach((h) => {
    holidayByDay.set(new Date(h.date).getDate(), h.name);
  });

  const attendanceMap = new Map();
  attendanceRows.forEach((row) => {
    const day = new Date(row.date).getDate();
    const key = `${row.employeeId.toString()}-${day}`;
    const overriddenByName = row.overriddenBy
      ? `${row.overriddenBy.firstName || ""} ${row.overriddenBy.lastName || ""}`.trim()
      : null;
    attendanceMap.set(key, {
      status: row.checkInAt || row.checkOutAt ? "present" : "absent",
      checkInAt: row.checkInAt || null,
      checkOutAt: row.checkOutAt || null,
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
      const key = `${leave.employeeId.toString()}-${d.getDate()}`;
      leaveMap.set(key, {
        isOnLeave: true,
        leaveType: leave.leaveTypeId?.name || "Leave"
      });
    });
  });

  const data = employees.map((emp) => {
    const days = {};
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${emp._id.toString()}-${day}`;
      const base = attendanceMap.get(key);
      const leaveInfo = leaveMap.get(key) || { isOnLeave: false, leaveType: null };
      const dateForDay = new Date(year, month - 1, day);
      const isWeekOff = weekOffDays.includes(dateForDay.getDay());
      const holidayName = holidayByDay.get(day) || null;
      days[day] = base || {
        status: "absent",
        checkInAt: null,
        checkOutAt: null,
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
  const { year, month, start, end, daysInMonth } = parseMonthRange(req.query.month);
  const employee = await getEmployeeFromReq(req);

  const [attendanceRows, weekOffConfig, holidays, approvedLeaves] = await Promise.all([
    Attendance.find({
      organizationId: req.user.organizationId,
      employeeId: employee._id,
      date: { $gte: start, $lte: end }
    })
      .select("date checkInAt checkOutAt overriddenBy overriddenAt shiftName shiftCode shiftStartTime shiftEndTime lateByMinutes earlyLoginByMinutes earlyCheckoutByMinutes overtimeMinutes")
      .populate("overriddenBy", "firstName lastName"),
    WeekOff.findOne({ organizationId: req.user.organizationId }).select("weekOffDays"),
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
    }).populate("leaveTypeId", "name")
  ]);

  const weekOffDays = weekOffConfig?.weekOffDays || [];
  const holidayByDay = new Map();
  holidays.forEach((h) => {
    holidayByDay.set(new Date(h.date).getDate(), h.name);
  });

  const days = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateForDay = new Date(year, month - 1, day);
    days[day] = {
      status: "absent",
      checkInAt: null,
      checkOutAt: null,
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
      isWeekOff: weekOffDays.includes(dateForDay.getDay()),
      holidayName: holidayByDay.get(day) || null
    };
  }
  attendanceRows.forEach((row) => {
    const day = new Date(row.date).getDate();
    const overriddenByName = row.overriddenBy
      ? `${row.overriddenBy.firstName || ""} ${row.overriddenBy.lastName || ""}`.trim()
      : null;
    days[day] = {
      ...days[day],
      status: row.checkInAt || row.checkOutAt ? "present" : "absent",
      checkInAt: row.checkInAt || null,
      checkOutAt: row.checkOutAt || null,
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
      const day = d.getDate();
      days[day] = {
        ...days[day],
        isOnLeave: true,
        leaveType: leave.leaveTypeId?.name || "Leave"
      };
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

  const day = startOfDay(date);
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
  const date = startOfDay(req.body.date);
  const today = startOfDay(new Date());
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
  const actorContext = await getActorApprovalContext(req);
  const rows = await AttendanceRequest.find({
    organizationId: req.user.organizationId,
    status: "pending",
    "approvalSteps.status": "pending"
  })
    .populate("employeeId", "firstName lastName employeeCode")
    .populate("actionBy", "firstName lastName employeeCode")
    .populate("approvalSteps.approverEmployeeId", "firstName lastName employeeCode")
    .populate("approvalSteps.actionBy", "firstName lastName employeeCode")
    .sort({ createdAt: -1 });

  return rows.filter((row) => {
    const step = getCurrentPendingStep(row.approvalSteps || []);
    return canActorApproveStep(step, actorContext);
  });
};

exports.actionAttendanceRequest = async (req) => {
  const request = await AttendanceRequest.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });
  if (!request) throw new Error("Attendance request not found");
  if (request.status !== "pending") throw new Error("Attendance request already actioned");

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

    if (!canActorApproveStep(currentStep, actorContext)) {
      throw new Error("You are not allowed to action this approval step");
    }

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

  const attendanceDate = startOfDay(request.date);
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
    checkInAt = combineDateAndTime(attendanceDate, request.requestedCheckInTime);
  }
  if (request.requestedCheckOutTime) {
    checkOutAt = combineDateAndTime(attendanceDate, request.requestedCheckOutTime);
  }

  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
    const nextDay = new Date(checkOutAt);
    nextDay.setDate(nextDay.getDate() + 1);
    checkOutAt = nextDay;
  }

  const { shift, scheduledStartAt, scheduledEndAt } = await resolveShiftSchedule(
    req.user.organizationId,
    request.employeeId,
    attendanceDate
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

  const date = startOfDay(req.body.date);
  await assertManageAccessForEmployee(req, employee._id);
  await validateAttendanceEditWindow(req.user.organizationId, date);
  const status = req.body.status;
  const { shift, scheduledStartAt, scheduledEndAt } = await resolveShiftSchedule(
    req.user.organizationId,
    employee._id,
    date
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
      overtimeMinutes: 0
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
      overtimeMinutes: 0
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
        date: toDateKey(date),
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

  const date = startOfDay(req.body.date);
  await validateAttendanceEditWindow(req.user.organizationId, date);

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
      date
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
        overtimeMinutes: 0
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
        overtimeMinutes: 0
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
          date: toDateKey(date),
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
  const today = startOfDay(new Date());

  const query = {
    organizationId: req.user.organizationId,
    date: today,
    checkInAt: { $ne: null },
    checkOutAt: null
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
    .sort({ checkInAt: -1 });
};

exports.getOnLeave = async (req) => {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

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
