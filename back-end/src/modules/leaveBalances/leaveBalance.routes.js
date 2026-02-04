const router = require("express").Router();
const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const asyncHandler = require("../../middlewares/asyncHandler");
const controller = require("./leaveBalance.controller");

// ✅ EMPLOYEE – own balance (SAFE PATH)
router.get(
  "/my",
  auth,
  authorize("LEAVE_VIEW_SELF"),
  asyncHandler(controller.getMyLeaveBalance)
);

// ✅ HR / MANAGER – employee balance
router.get(
  "/employee/:employeeId",
  auth,
  authorize("LEAVE_VIEW_ALL"),
  asyncHandler(controller.getEmployeeLeaveBalance)
);

module.exports = router;
