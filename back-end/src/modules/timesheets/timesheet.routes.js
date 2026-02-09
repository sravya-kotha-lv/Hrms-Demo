const router = require("express").Router();
const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const validate = require("../../middlewares/validate.middleware");
const asyncHandler = require("../../middlewares/asyncHandler");

const controller = require("./timesheet.controller");
const {
  createWeeklySchema,
  updateWeeklySchema,
  submitWeeklySchema,
  actionWeeklySchema
} = require("./timesheet.validation");

// Check-in / Check-out
router.post(
  "/check-in",
  auth,
  authorize("TIMESHEET_CHECKIN_SELF"),
  asyncHandler(controller.checkIn)
);

router.post(
  "/check-out",
  auth,
  authorize("TIMESHEET_CHECKOUT_SELF"),
  asyncHandler(controller.checkOut)
);

// Attendance views
router.get(
  "/attendance/my",
  auth,
  authorize("TIMESHEET_VIEW_SELF"),
  asyncHandler(controller.myAttendance)
);

router.get(
  "/attendance",
  auth,
  authorize("TIMESHEET_VIEW_ALL"),
  asyncHandler(controller.attendanceList)
);

router.get(
  "/online",
  auth,
  authorize("TIMESHEET_VIEW_ONLINE"),
  asyncHandler(controller.online)
);

router.get(
  "/on-leave",
  auth,
  authorize("TIMESHEET_VIEW_ALL"),
  asyncHandler(controller.onLeave)
);

// Weekly timesheets (employee)
router.post(
  "/weekly",
  auth,
  authorize("TIMESHEET_CREATE_SELF"),
  validate(createWeeklySchema),
  asyncHandler(controller.createWeekly)
);

router.get(
  "/weekly/my",
  auth,
  authorize("TIMESHEET_VIEW_SELF"),
  asyncHandler(controller.myWeekly)
);

router.put(
  "/weekly/:id",
  auth,
  authorize("TIMESHEET_EDIT_SELF"),
  validate(updateWeeklySchema),
  asyncHandler(controller.updateWeekly)
);

router.post(
  "/weekly/:id/submit",
  auth,
  authorize("TIMESHEET_SUBMIT_SELF"),
  validate(submitWeeklySchema),
  asyncHandler(controller.submitWeekly)
);

router.post(
  "/weekly/:id/recall",
  auth,
  authorize("TIMESHEET_RECALL_SELF"),
  asyncHandler(controller.recallWeekly)
);

// Weekly timesheets (admin/manager)
router.get(
  "/weekly",
  auth,
  authorize("TIMESHEET_VIEW_ALL"),
  asyncHandler(controller.listWeekly)
);

router.put(
  "/weekly/:id/action",
  auth,
  authorize("TIMESHEET_ACTION"),
  validate(actionWeeklySchema),
  asyncHandler(controller.actionWeekly)
);

module.exports = router;
