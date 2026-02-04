const router = require("express").Router();
const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const validate = require("../../middlewares/validate.middleware");
const asyncHandler = require("../../middlewares/asyncHandler");

const controller = require("./leave.controller");
const {
  applyLeaveSchema,
  leaveActionSchema
} = require("./leave.validation");

// Employee applies leave
router.post(
  "/apply",
  auth,
  authorize("LEAVE_APPLY"),
  validate(applyLeaveSchema),
  asyncHandler(controller.apply)
);

// Employee views own leaves
router.get(
  "/my",
  auth,
  authorize("LEAVE_VIEW_SELF"),
  asyncHandler(controller.myLeaves)
);

// HR / Manager views all leaves
router.get(
  "/",
  auth,
  authorize("LEAVE_VIEW_ALL"),
  asyncHandler(controller.list)
);

// Approve / Reject
router.put(
  "/:id/action",
  auth,
  authorize("LEAVE_ACTION"),
  validate(leaveActionSchema),
  asyncHandler(controller.action)
);

module.exports = router;
