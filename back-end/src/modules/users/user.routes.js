const router = require("express").Router();
const asyncHandler = require("../../middlewares/asyncHandler");
const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const validate = require("../../middlewares/validate.middleware");
const { publicLimiter } = require("../../middlewares/rateLimiter");

const controller = require("./user.controller");
const validator = require("./user.validator");

router.post(
  "/login",
  publicLimiter,
  validate(validator.loginSchema),
  asyncHandler(controller.login)
);

router.get(
  "/",
  auth,
  authorize("USER_VIEW"),
  asyncHandler(controller.listByOrganization)
);

router.post(
  "/org-user",
  auth,
  authorize("USER_CREATE"),
  validate(validator.createUserSchema),
  asyncHandler(controller.createUser)
);

router.post(
  "/switch-org",
  auth,
  validate(validator.switchOrgSchema),
  asyncHandler(controller.switchOrganization)
);

router.get(
  "/me/permissions",
  auth,
  asyncHandler(controller.myPermissions)
);

router.get(
  "/me/profile",
  auth,
  asyncHandler(controller.myProfile)
);

router.post(
  "/send-otp",
  publicLimiter,
  validate(validator.sendOTPUserSchema),
  asyncHandler(controller.sendOtp)
);
router.post(
  "/verify-otp",
  publicLimiter,
  validate(validator.validateOTPSchema),
  asyncHandler(controller.verifyOtp)
);


module.exports = router;
