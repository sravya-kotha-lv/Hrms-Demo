const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const validate = require("../../middlewares/validate.middleware");
const asyncHandler = require("../../middlewares/asyncHandler");

const {
  createEmployeeSchema,
  updateEmployeeSchema
} = require("./employee.validation");

const employeeController = require("./employee.controller");

router.post(
  "/",
  auth,
  authorize("EMP_CREATE"),
  validate(createEmployeeSchema),
  asyncHandler(employeeController.create)
);

router.put(
  "/:id",
  auth,
  authorize("EMP_UPDATE"),
  validate(updateEmployeeSchema),
  asyncHandler(employeeController.update)
);

router.delete(
  "/:id",
  auth,
  authorize("EMP_DELETE"),
  asyncHandler(employeeController.remove)
);

router.get(
  "/",
  auth,
  authorize("EMP_VIEW"),
  asyncHandler(employeeController.list)
);

router.get(
  "/:id",
  auth,
  authorize("EMP_VIEW"),
  asyncHandler(employeeController.getById)
);

router.get(
  "/me",
  auth,
  authorize("EMP_SELF_VIEW"),
  asyncHandler(employeeController.getMe)
);

router.patch(
  "/:id/restore",
  auth,
  authorize("DEPT_RESTORE"),
  asyncHandler(departmentController.restore)
);

module.exports = router;
