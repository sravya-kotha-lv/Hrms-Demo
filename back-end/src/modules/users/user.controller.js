const userService = require("./user.service");
const {
  buildSuccessResponse,
  buildFailureResponse
} = require("../../utils/responseBuilder");

exports.login = async (req, res) => {
  try {
    const result = await userService.loginUser(req.body);
    console.log(result,"result");
    
    res.setHeader("Authorization", result?.token);
    delete result.token;
    return res.status(200).json(
      buildSuccessResponse({
        code: 200,
        message: "Login successful",
        data: result
      })
    );
  } catch (err) {
    console.log(err,"err");
    
    return res.status(err.code || 500).json(
      buildFailureResponse({
        code: err.code || 500,
        message: err.message || "Login failed",
        error: err.error || null
      })
    );
  }
};

exports.createUser = async (req, res) => {
  try {
    const result = await userService.createOrgUser({
      ...req.body,
      creator: req.user
    });

    return res.status(201).json(
      buildSuccessResponse({
        code: 201,
        message: "User created successfully",
        data: result
      })
    );
  } catch (err) {
    return res.status(err.code || 500).json(
      buildFailureResponse({
        code: err.code || 500,
        message: err.message || "User creation failed",
        error: err.error || null
      })
    );
  }
};

exports.switchOrganization = async (req, res) => {
  try {
    const result = await userService.switchOrgAndRole({
      user: req.user,
      organizationId: req.body.organizationId,
    });
    res.setHeader("Authorization", result?.token);
    delete result.token;

    return res.status(200).json(
      buildSuccessResponse({
        code: 200,
        message: "Context switched successfully",
        data: result
      })
    );
  } catch (err) {
    return res.status(err.code || 500).json(
      buildFailureResponse({
        code: err.code || 500,
        message: err.message || "Failed to switch context",
        error: err.error || null
      })
    );
  }
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