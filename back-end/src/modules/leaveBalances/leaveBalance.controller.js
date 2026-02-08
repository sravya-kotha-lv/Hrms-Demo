const service = require("./leaveBalance.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

// /me
exports.getMyLeaveBalance = async (req, res) => {
  const data = await service.getEmployeeBalance(
    req.user.organizationId,
    req.user.userId,        // ✅ USE TOKEN userId AS STRING
    "USER"
  );

  return res.status(200).json(
    buildSuccessResponse({ data })
  );
};

// /employee/:employeeId
exports.getEmployeeLeaveBalance = async (req, res) => {
  const data = await service.getEmployeeBalance(
    req.user.organizationId,
    req.params.employeeId,
    "EMPLOYEE"
  );

  return res.status(200).json(
    buildSuccessResponse({ data })
  );
};
