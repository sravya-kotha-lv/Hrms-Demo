const Timesheet = require("./timesheet.model");
const Attendance = require("./timesheetAttendance.model");
const Employee = require("../employees/employee.model");
const { audit } = require("../auditLogs/auditLogs.service");

const startOfDay = (value) => {
  const d = new Date(value);
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

const toDateKey = (value) => startOfDay(value).toISOString().slice(0, 10);

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

  return Attendance.find({
    organizationId: req.user.organizationId,
    date: { $gte: startDate, $lte: endDate }
  })
    .populate("employeeId", "firstName lastName employeeCode")
    .sort({ date: -1, checkInAt: -1 });
};

exports.getOnline = async (req) => {
  const today = startOfDay(new Date());

  return Attendance.find({
    organizationId: req.user.organizationId,
    date: today,
    checkInAt: { $ne: null },
    checkOutAt: null
  })
    .populate("employeeId", "firstName lastName employeeCode")
    .sort({ checkInAt: -1 });
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

  const entries = sanitizeEntries(req.body.entries || [], timesheet.weekStart);
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

  if (!["draft", "rejected"].includes(timesheet.status)) {
    throw new Error("Timesheet already submitted");
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
  return Timesheet.find({
    organizationId: req.user.organizationId
  })
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
