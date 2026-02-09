const Timesheet = require("./timesheet.model");
const Attendance = require("./timesheetAttendance.model");
const Employee = require("../employees/employee.model");
const Leave = require("../leaves/leave.model");
const { audit } = require("../auditLogs/auditLogs.service");
const Role = require("../roles/role.model");
const OrgSettings = require("../orgSettings/orgSettings.model");

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

exports.checkIn = async (req) => {
  const employee = await getEmployeeFromReq(req);
  const now = new Date();
  const today = startOfDay(now);

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

  const attendance = await Attendance.create({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: today,
    checkInAt: now,
    status: "checked_in"
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
  const today = startOfDay(now);

  const attendance = await Attendance.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    date: today
  });

  if (!attendance || !attendance.checkInAt) {
    throw new Error("You are not checked in today");
  }

  if (attendance.checkOutAt) {
    throw new Error("Already checked out for today");
  }

  const totalMinutes = Math.max(
    0,
    Math.round((now.getTime() - attendance.checkInAt.getTime()) / 60000)
  );

  attendance.checkOutAt = now;
  attendance.totalMinutes = totalMinutes;
  attendance.status = "checked_out";
  await attendance.save();

  // Update weekly timesheet hours for today
  const hoursWorked = Number((totalMinutes / 60).toFixed(2));
  await upsertTimesheetHours({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    dateValue: today,
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
console.log(timesheet,entries,"-----",req.body.entries);

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
