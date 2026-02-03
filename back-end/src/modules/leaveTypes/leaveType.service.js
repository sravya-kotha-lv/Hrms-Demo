const LeaveType = require("./leaveType.model");

exports.createLeaveType = async (req) => {
  const { name, code, descriptoin, daysPerYear, isCarryForward } = req.body; 
  const organizationId = req.user.organizationId;
  const exists = await LeaveType.findOne({ 
    organizationId, 
    code: code 
  });
  if (exists) throw { code: 400, message: "Leave type code already exists for this org" };
  
  return await LeaveType.create({ name, code, descriptoin, daysPerYear, isCarryForward, organizationId});
};

exports.getLeaveTypesByOrg = async (organizationId) => {
  return await LeaveType.find({ organizationId });
};

exports.getEmployeeleaves = async (req) => {
  return await LeaveType.find({ organizationId: req.user?.organizationId, status: "active" });
};

exports.updateLeaveType = async (id, data) => {
  const leaveType = await LeaveType.findByIdAndUpdate(id, data, { new: true });
  if (!leaveType) throw { code: 404, message: "Leave type not found" };
  return leaveType;
};

exports.deleteLeaveType = async (id) => {
  return await LeaveType.findByIdAndUpdate(id, { status: "inactive" });
};

/**
 * UPDATE LEAVE TYPE
 * This handles both general info changes and manual status toggling
 */
exports.updateLeaveType = async (id, payload) => {
  const leaveType = await LeaveType.findByIdAndUpdate(
    id,
    payload,
    { new: true, runValidators: true }
  );

  if (!leaveType) {
    throw { code: 404, message: "Leave type not found" };
  }

  return leaveType;
};

/**
 * SOFT DELETE
 * Explicitly sets status to 'inactive'
 */
exports.deleteLeaveType = async (id) => {
  const leaveType = await LeaveType.findByIdAndUpdate(
    id,
    { status: "inactive" },
    { new: true }
  );

  if (!leaveType) {
    throw { code: 404, message: "Leave type not found" };
  }

  return true;
};
