const Leave = require("./leave.model");
const Employee = require("../employees/employee.model");
const LeaveType = require("../leaveTypes/leaveType.model");
const { audit } = require("../auditLogs/auditLogs.service");

const calculateDays = (from, to) => {
  const diff =
    (new Date(to).setHours(0,0,0,0) -
     new Date(from).setHours(0,0,0,0))
    / (1000 * 60 * 60 * 24);
  return diff + 1;
};

exports.applyLeave = async (req) => {

  console.log(req.body);
  // 1. Find employee from logged-in user
  // const employee = await Employee.findOne({
  //   userId: req.user._id,
  //   organizationId: req.user.organizationId
  // });
  const employee = req.user.userId;
  if (!employee) throw new Error("Employee not found");

  // 2. Validate leave type
  const leaveType = await LeaveType.findOne({
    _id: req.body.leaveTypeId,
    organizationId: req.user.organizationId,
    status: "active"
  });
  if (!leaveType) throw new Error("Invalid leave type");

  // 3. Calculate days
  const totalDays = calculateDays(req.body.fromDate, req.body.toDate);

  // 4. Create leave
  const leave = await Leave.create({
    organizationId: req.user.organizationId,
    employeeId: employee._id,
    leaveTypeId: req.body.leaveTypeId,
    fromDate: req.body.fromDate,
    toDate: req.body.toDate,
    totalDays,
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
    userId: req.user._id,
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

  const actor = await Employee.findOne({
    userId: req.user._id,
    organizationId: req.user.organizationId
  });

  leave.status = req.body.status;
  leave.actionBy = actor?._id;
  leave.actionAt = new Date();

  if (req.body.status === "rejected") {
    leave.rejectionReason = req.body.rejectionReason;
  }

  await leave.save();
  return leave;
};
