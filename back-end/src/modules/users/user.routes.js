const router = require("express").Router();
const asyncHandler = require("../../middlewares/asyncHandler");
const validate = require("../../middlewares/validate.middleware");

const userController = require("./user.controller");
const {
  registerUserSchema,
  loginUserSchema,
  sendOTPUserSchema,
  validateOTPSchema
} = require("./user.validator");

router.post("/register", validate(registerUserSchema), asyncHandler(userController.register));
router.post("/login", validate(loginUserSchema), asyncHandler(userController.login));
router.post("/send-otp", validate(sendOTPUserSchema), asyncHandler(userController.sendOtp));
router.post("/verify-otp", validate(validateOTPSchema), asyncHandler(userController.verifyOtp));

module.exports = router;
