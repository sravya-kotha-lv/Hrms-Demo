const userService = require("./user.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.register = async (req, res) => {
  const data = await userService.register(req);
  return res.status(201).json(
    buildSuccessResponse({
      code: 201,
      message: "User registered successfully",
      data
    })
  );
};

exports.login = async (req, res) => {
  const data = await userService.login(req);

  res.setHeader("Access-Control-Expose-Headers", "Authorization");
  res.setHeader("Authorization", `Bearer ${data.token}`);
  delete data.token;

  return res.status(200).json(
    buildSuccessResponse({
      message: "Login successful",
      data
    })
  );
};

exports.sendOtp = async (req, res) => {
  await userService.sendOtp(req.body);
  return res.json(
    buildSuccessResponse({
      message: "OTP sent successfully"
    })
  );
};

exports.verifyOtp = async (req, res) => {
  await userService.verifyOtp(req.body);
  return res.json(
    buildSuccessResponse({
      message: "OTP verified successfully"
    })
  );
};