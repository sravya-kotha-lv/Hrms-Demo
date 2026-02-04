const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const validate = require("../../middlewares/validate.middleware");
const asyncHandler = require("../../middlewares/asyncHandler");

const {
  createEmployeeByHrSchema,
  completeProfileSchema,
  employeeLoginSchema
} = require("./employee.validation");

const controller = require("./employee.controller");

// router.post('/login',validate(employeeLoginSchema), asyncHandler(controller.login))
/**
 * HR / ADMIN creates employee (onboarding)
 */
router.post(
  "/",
  auth,
  authorize("EMP_CREATE"),
  validate(createEmployeeByHrSchema),
  asyncHandler(controller.createByHr)
);

/**
 * Employee completes own profile (first login)
 */
router.put(
  "/me/profile",
  auth,
  authorize("EMP_SELF_EDIT"),
  validate(completeProfileSchema),
  asyncHandler(controller.completeMyProfile)
);

router.get(
  "/",
  auth,
  authorize("EMP_VIEW"),
  asyncHandler(controller.listByOrganization)
);

router.get("/leave-types", auth, asyncHandler(controller.getEmployeeleaves));

module.exports = router;
