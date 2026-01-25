const UserModel = require("./user.model");
const { checkPasswords, genHashedPassword } = require("../../utils/bcryptUtils");
const { createJwtToken } = require("../../utils/jwtToken");
const { getRolesByIds } = require("../roles/role.service");
const sendMail = require("../../utils/sendMail");
const { rotateUserToken } = require("../../utils/tokenManager");

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * REGISTER
 */
exports.register = async (req) => {
  const { email, password } = req.body;

  const exists = await UserModel.findOne({ email });
  if (exists) {
    throw { code: 409, message: "Already Email registered." };
  }

  const hashedPwd = await genHashedPassword(password);

  const user = await UserModel.create({
    ...req.body,
    password: hashedPwd,
    roleIds: req.body.roleIds || []
  });

  return user;
};

/**
 * LOGIN
 */
exports.login = async (req) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({ email }).select("+password");
  if (!user) {
    throw { code: 400, message: "Email ID is not registered" };
  }

  const valid = await checkPasswords(password, user.password);
  if (!valid) {
    throw { code: 400, message: "Incorrect password" };
  }

  const roles =
    user.roleIds?.length > 0
      ? await getRolesByIds(user.roleIds)
      : [];

  const activeRole = roles[0];

  const token = createJwtToken({
    _id: user._id,
    email: user.email,
    organizationId: user.organizationId,
    roleIds: user.roleIds,
    activeRoleId: activeRole?._id
  });

  // let tokenList = user.tokenList || [];
  // const limit = Number(process.env.TOKEN_LIST_LIMIT || 10);
  // tokenList.length >= limit && tokenList.shift();

  // await UserModel.findByIdAndUpdate(user._id, {
  //   tokenList: [
  //     ...tokenList,
  //     {
  //       token,
  //       loginTimestamp: new Date().toUTCString(),
  //       status: "success"
  //     }
  //   ],
  //   lastLoginAt: new Date()
  // });
  
  await rotateUserToken(UserModel, user._id, token);

  return {
    token,
    activeRole,
    availableRoles: roles
  };
};

/**
 * SEND OTP
 */
exports.sendOtp = async ({ email }) => {
  const user = await UserModel.findOne({ email });
  if (!user) {
    throw { code: 404, message: "Email not registered" };
  }

  const otp = generateOtp();

  await UserModel.updateOne(
    { email },
    {
      otp,
      otpTimestamp: Date.now(),
      otpAttempts: 0
    }
  );

  await sendMail(
    "otp",
    email,
    "Your OTP",
    otp,
    email
  );
};

/**
 * VERIFY OTP
 */
exports.verifyOtp = async ({ email, otp }) => {
  const user = await UserModel.findOne({ email });
  if (!user) throw { code: 404, message: "User not found" };

  if (user.otp !== otp) {
    user.otpAttempts += 1;
    await user.save();
    throw { code: 400, message: "Invalid OTP" };
  }

  if (Date.now() - user.otpTimestamp > OTP_EXPIRY_MS) {
    throw { code: 400, message: "OTP expired" };
  }

  await UserModel.updateOne(
    { email },
    { otp: null, otpTimestamp: null, otpAttempts: 0 }
  );
};
