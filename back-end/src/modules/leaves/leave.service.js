const Leave = require("./leave.model");
const Employee = require("../employees/employee.model");
const LeaveType = require("../leaveTypes/leaveType.model");
const { audit } = require("../auditLogs/auditLogs.service");
const Holiday = require("../holidays/holiday.model");
const WeekOff = require("../weekOffs/weekOff.model");
const LeaveBalance =
  require("../leaveBalances/leaveBalance.model");
const Organization =
  require("../organizations/organization.model");


const calculateDays = (from, to) => {
  const diff =
    (new Date(to).setHours(0, 0, 0, 0) -
      new Date(from).setHours(0, 0, 0, 0))
    / (1000 * 60 * 60 * 24);
  return diff + 1;
};

const isSameDate = (d1, d2) =>
  new Date(d1).setHours(0, 0, 0, 0) === new Date(d2).setHours(0, 0, 0, 0);

exports.applyLeave = async (req) => {

  // 1. Find employee from logged-in user
  // const employee = await Employee.findOne({
  //   userId: req.user.userId,
  //   organizationId: req.user.organizationId
  // });

  const fromDate = new Date(req.body.fromDate);
  const toDate = new Date(req.body.toDate);

  if (fromDate > toDate) {
    throw new Error("From date cannot be greater than to date");
  }

  const employee = req.user.userId;
  if (!employee) throw new Error("Employee not found");

  /* 🔒 STEP 4A: CHECK OVERLAPPING LEAVES */
  const overlappingLeave = await Leave.findOne({
    employeeId: employee._id,
    status: { $in: ["pending", "approved"] },
    $or: [
      {
        fromDate: { $lte: req.body.toDate },
        toDate: { $gte: req.body.fromDate }
      }
    ]
  });

  if (overlappingLeave) {
    throw new Error("You already have a leave applied for these dates");
  }

  const year = fromDate.getFullYear();

  const holidays = await Holiday.find({
    organizationId: req.user.organizationId,
    year,
    date: { $gte: fromDate, $lte: toDate },
    status: "active"
  });

  const weekOffConfig = await WeekOff.findOne({
    organizationId: req.user.organizationId
  });

  const weekOffDays = weekOffConfig?.weekOffDays || [];

  let validLeaveDates = [];
  let currentDate = new Date(fromDate);

  while (currentDate <= toDate) {
    const dayOfWeek = currentDate.getDay();

    const isWeekOff = weekOffDays.includes(dayOfWeek);

    const isHoliday = holidays.some(h =>
      isSameDate(h.date, currentDate)
    );

    if (!isWeekOff && !isHoliday) {
      validLeaveDates.push(new Date(currentDate));
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (
    fromDate.getTime() === toDate.getTime() &&
    validLeaveDates.length === 0
  ) {
    throw new Error("Selected date is a holiday or week off");
  }

  if (validLeaveDates.length === 0) {
    throw new Error("Selected dates fall on holidays or week offs");
  }



  // 2. Validate leave type
  const leaveType = await LeaveType.findOne({
    _id: req.body.leaveTypeId,
    organizationId: req.user.organizationId,
    status: "active"
  });
  if (!leaveType) throw new Error("Invalid leave type");

  // 3. Calculate days
  // const totalDays = calculateDays(req.body.fromDate, req.body.toDate);
  const totalDays = validLeaveDates.length;

  const org = await Organization.findById(req.user.organizationId);

  const cycleStartYear =
    fromDate.getMonth() + 1 < org.leaveCycleStartMonth
      ? fromDate.getFullYear() - 1
      : fromDate.getFullYear();

  const balance = await LeaveBalance.findOne({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    leaveTypeId: req.body.leaveTypeId,
    cycleStartYear
  });

  if (!balance || balance.remaining < totalDays) {
    throw new Error("Insufficient leave balance");
  }


  // 4. Create leave
  const leave = await Leave.create({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    leaveTypeId: req.body.leaveTypeId,
    fromDate: req.body.fromDate,
    toDate: req.body.toDate,
    totalDays,
    status: "pending",
    reason: req.body.reason
  });

  // 5. Audit
  await audit({
    req,
    module: "leaves",
    action: "APPLY",
    entityId: leave._id,
    after: leave.toObject()
  });

  return leave;
};

exports.getMyLeaves = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  return Leave.find({ employeeId: employee._id })
    .populate("leaveTypeId", "name code")
    .sort({ createdAt: -1 });
};

exports.getAllLeaves = async (req) => {
  return Leave.find({ organizationId: req.user.organizationId })
    .populate("employeeId", "firstName lastName employeeCode")
    .populate("leaveTypeId", "name code")
    .sort({ createdAt: -1 });
};

exports.actionLeave = async (req) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new Error("Leave not found");

  // 🔒 store previous status (VERY IMPORTANT)
  const previousStatus = leave.status;

  const actor = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  if (req.body.status === "approved") {
    // 🔥 APPROVAL FLOW (deduct balance)
    // ❌ Prevent double approval
    if (leave.status === "approved") {
      throw new Error("Leave already approved");
    }
    const org = await Organization.findById(leave.organizationId);

    const cycleStartYear =
      new Date(leave.fromDate).getMonth() + 1 < org.leaveCycleStartMonth
        ? new Date(leave.fromDate).getFullYear() - 1
        : new Date(leave.fromDate).getFullYear();

    const balance = await LeaveBalance.findOne({
      organizationId: leave.organizationId,
      employeeId: leave.employeeId,
      leaveTypeId: leave.leaveTypeId,
      cycleStartYear
    });

    if (!balance || balance.remaining < leave.totalDays) {
      throw new Error("Insufficient leave balance to approve");
    }

    balance.used += leave.totalDays;
    balance.remaining -= leave.totalDays;
    await balance.save();

  } else if (req.body.status === "rejected") {
    // 🔁 RESTORE BALANCE ONLY IF IT WAS APPROVED EARLIER
    if (previousStatus === "approved") {

      const org = await Organization.findById(leave.organizationId);

      const cycleStartYear =
        new Date(leave.fromDate).getMonth() + 1 < org.leaveCycleStartMonth
          ? new Date(leave.fromDate).getFullYear() - 1
          : new Date(leave.fromDate).getFullYear();

      const balance = await LeaveBalance.findOne({
        organizationId: leave.organizationId,
        employeeId: leave.employeeId,
        leaveTypeId: leave.leaveTypeId,
        cycleStartYear
      });

      if (balance) {
        balance.used -= leave.totalDays;
        balance.remaining += leave.totalDays;
        await balance.save();
      }
    }
    leave.rejectionReason = req.body.rejectionReason;
  } else {
    throw new Error("Invalid leave action");
  }
  leave.status = req.body.status;
  leave.actionBy = actor?._id;
  leave.actionAt = new Date();

  await leave.save();
  return leave;
};
