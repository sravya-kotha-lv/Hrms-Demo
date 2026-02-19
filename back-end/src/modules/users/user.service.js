const User = require("./user.model");
const OrgUser = require("../organizations/org-user.model");
const { genHashedPassword, checkPasswords } = require("../../utils/bcryptUtils");
const { createJwtToken } = require("../../utils/jwtToken");
const { rotateUserToken } = require("../../utils/tokenManager");
const Role = require("../roles/role.model");
const Permission = require("../permissions/permission.model");
const sendMail = require("../../utils/sendMail");
const Employee = require("../employees/employee.model");
const leaveBalanceService = require("../leaveBalances/leaveBalance.service");

exports.loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw {
      code: 400,
      message: "Email and password are required"
    };
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user) {
    throw {
      code: 400,
      message: "Email not registered"
    };
  }

  const valid = await checkPasswords(password, user.password);
  if (!valid) {
    throw {
      code: 400,
      message: "Incorrect password"
    };
  }

  const memberships = await OrgUser
    .find({ userId: user._id })
    .populate("organizationId")
    .populate("roleIds");

  if (!memberships || memberships.length === 0) {
    throw {
      code: 403,
      message: "No organization access"
    };
  }

  const m = memberships[0];
  const employee = await Employee.findOne({
    userId: user._id,
    organizationId: m.organizationId?._id || m.organizationId,
    isDeleted: false
  }).select("employmentLifecycleStatus noticeEndDate");

  if (employee?.employmentLifecycleStatus === "terminated") {
    throw {
      code: 403,
      message: "Your employment has been terminated. Please contact your manager."
    };
  }

  if (employee?.employmentLifecycleStatus === "notice") {
    const now = new Date();
    const noticeEndDate = employee.noticeEndDate ? new Date(employee.noticeEndDate) : null;

    if (noticeEndDate) {
      noticeEndDate.setHours(23, 59, 59, 999);
    }

    if (noticeEndDate && now > noticeEndDate) {
      throw {
        code: 403,
        message: "Your notice period is completed. Please contact your manager."
      };
    }
  }

  const activeRole = m.roleIds[0] || null;

  const token = createJwtToken({
    userId: user._id,
    organizationId: m.organizationId._id,
    roleIds: m.roleIds.map(r => r._id),
    activeRoleId: activeRole?._id
  });

  await rotateUserToken(User, user._id, token);

  return {
    token,
    userId: user._id,
    organization: m.organizationId,
    roles: m.roleIds,
    activeRole
  };
};

exports.createOrgUser = async ({
  email,
  password,
  roleIds,
  firstName,
  lastName,
  departmentId,
  designationId,
  employmentType,
  dateOfJoining,
  managerId,
  shiftId,
  creator
}) => {
  const normalizedEmail = email.toLowerCase().trim();

  /**
   * 0️⃣ Resolve active org safely
   */
  const activeOrgId = creator.activeOrganizationId || creator.organizationId;

  if (!activeOrgId) {
    throw {
      code: 400,
      message: "No active organization selected"
    };
  }

  /**
   * 1️⃣ Check if user already exists
   */
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw {
      code: 409,
      message: "User with this email already exists"
    };
  }

  /**
   * 2️⃣ Validate roles belong to active org
   */
  const roles = await Role.find({
    _id: { $in: roleIds },
    organizationId: activeOrgId
  });

  if (roles.length !== roleIds.length) {
    throw {
      code: 400,
      message: "Invalid role(s) for this organization"
    };
  }

  /**
   * 3️⃣ Create user
   */
  const user = await User.create({
    email: normalizedEmail,
    password: await genHashedPassword(password),
    organizationIds: [activeOrgId],
    activeOrganizationId: activeOrgId,
    status: "active"
  });

  /**
   * 4️⃣ Map user to organization
   */
  await OrgUser.create({
    userId: user._id,
    organizationId: activeOrgId,
    roleIds
  });

  const employeeCode = await generateEmployeeCode(activeOrgId);
  const employee = await Employee.create({
    organizationId: activeOrgId,
    userId: user._id,
    firstName,
    lastName,
    employeeCode,
    departmentId: departmentId || undefined,
    designationId: designationId || undefined,
    dateOfJoining,
    employmentType,
    managerId: managerId || undefined,
    shiftId: shiftId || undefined,
    profileCompleted: false
  });

  await leaveBalanceService.initializeForEmployee(employee, activeOrgId);

  await sendMail(
  "employeeOnboarding",
  user.email,
  "Welcome to Luvetha HRMS",
  {
    email: user.email,
    password,
    orgName: "Luvetha",
    loginUrl: process.env.FRONTEND_LOGIN_URL
  },
  user.email
).catch((result) => {
  return result;
});


  return {
    userId: user._id,
    email: user.email
  };
};

async function generateEmployeeCode(organizationId) {
  const prefix = (process.env.EMPLOYEE_CODE_PREFIX || "LV").trim() || "LV";
  let sequence = await Employee.countDocuments(
    { organizationId, isDeleted: false }
  );

  while (true) {
    sequence += 1;
    const code = `${prefix}-${String(sequence).padStart(4, "0")}`;
    const exists = await Employee.findOne(
      { organizationId, employeeCode: code },
      "_id"
    );
    if (!exists) return code;
  }
}

exports.listByOrganization = async ({ organizationId, query }) => {
  const { page = 1, limit = 20, search } = query || {};
  const skip = (Number(page) - 1) * Number(limit);

  const userFilter = {};
  if (search) {
    userFilter.email = { $regex: search, $options: "i" };
  }

  const [memberships, total] = await Promise.all([
    OrgUser.find({ organizationId })
      .populate({
        path: "userId",
        select: "email status activeOrganizationId",
        match: userFilter
      })
      .populate({
        path: "roleIds",
        select: "name slug"
      })
      .skip(skip)
      .limit(Number(limit)),
    OrgUser.countDocuments({ organizationId })
  ]);

  const items = memberships
    .filter(m => m.userId)
    .map(m => ({
      userId: m.userId._id,
      email: m.userId.email,
      status: m.userId.status,
      activeOrganizationId: m.userId.activeOrganizationId,
      roles: m.roleIds
    }));

  return {
    items,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
};

exports.switchOrgAndRole = async ({
  user,
  organizationId,
  roleId
}) => {
  /**
   * 1️⃣ Load full user
   */
  const dbUser = await User.findById(user.userId);
  if (!dbUser) {
    throw { code: 401, message: "User not found" };
  }

  /**
   * 2️⃣ Detect SuperAdmin
   * Rule: coming from SYSTEM org
   */
  const isSuperAdmin =
    user.organizationId &&
    user.organizationId.toString() !== organizationId &&
    user.organizationId.toString() === process.env.SYSTEM_ORG_ID;

  /**
   * 🔥 SUPERADMIN FLOW
   */
  if (isSuperAdmin) {
    /**
     * 3️⃣ Resolve OrgAdmin role
     */
    let activeRole;

    if (roleId) {
      activeRole = await Role.findOne({
        _id: roleId,
        organizationId
      });
    } else {
      activeRole = await Role.findOne({
        slug: "org-admin",
        organizationId
      });
    }

    if (!activeRole) {
      throw {
        code: 400,
        message: "OrgAdmin role not found for organization"
      };
    }

    /**
     * 4️⃣ Ensure OrgUser membership exists
     */
    let membership = await OrgUser.findOne({
      userId: user._id,
      organizationId
    });

    if (!membership) {
      membership = await OrgUser.create({
        userId: user._id,
        organizationId,
        roleIds: [activeRole._id]
      });
    }

    /**
     * 5️⃣ Issue new JWT
     */
    const token = createJwtToken({
      _id: user._id,
      email: user.email,
      organizationId,
      roleIds: [activeRole._id],
      activeRoleId: activeRole._id,
    });

    /**
     * 6️⃣ Persist active org
     */
    await User.findByIdAndUpdate(user._id, {
      activeOrganizationId: organizationId
    });

    /**
     * 7️⃣ Rotate token
     */
    await rotateUserToken(User, user._id, token);

    return {
      token,
      organizationId,
      activeRoleId: activeRole._id,
      roles: [activeRole]
    };
  }

  /**
   * 🔒 NORMAL USER FLOW
   */
  const membership = await OrgUser.findOne({
    userId: user.userId,
    organizationId
  }).populate("roleIds");

  if (!membership) {
    throw {
      code: 403,
      message: "User does not belong to this organization"
    };
  }

  let activeRoleId;

  if (roleId) {
    const role = membership.roleIds.find(
      r => r._id.toString() === roleId
    );

    if (!role) {
      throw {
        code: 403,
        message: "Role not assigned in this organization"
      };
    }

    activeRoleId = role._id;
  } else {
    activeRoleId = membership.roleIds[0]?._id;
  }

  if (!activeRoleId) {
    throw {
      code: 400,
      message: "No role available for this organization"
    };
  }

  const token = createJwtToken({
    _id: user.userId,
    email: user.email,
    organizationId,
    roleIds: membership.roleIds.map(r => r._id),
    activeRoleId
  });

  await User.findByIdAndUpdate(user.userId, {
    activeOrganizationId: organizationId
  });

  await rotateUserToken(User, user.userId, token);

  return {
    token,
    organizationId,
    activeRoleId,
    roles: membership.roleIds
  };
};

exports.getActivePermissions = async ({ user }) => {
  if (!user?.activeRoleId) {
    throw { code: 403, message: "Active role not set" };
  }

  const role = await Role.findOne({
    _id: user.activeRoleId,
    organizationId: user.organizationId
  });

  if (!role) {
    throw { code: 404, message: "Role not found" };
  }

  if (role.isSystemRole) {
    return ["*"];
  }

  if (!role.permissionIds?.length) return [];

  const permissions = await Permission.find({
    _id: { $in: role.permissionIds },
    organizationId: user.organizationId
  }).select("code");

  return permissions.map((p) => p.code);
};

exports.getMyProfile = async ({ user }) => {
  const userDoc = await User.findById(user.userId).select("email");
  const employee = await Employee.findOne({
    userId: user.userId,
    organizationId: user.organizationId
  }).select("_id firstName lastName employeeCode managerId profileImage");

  return {
    email: userDoc?.email || null,
    employeeId: employee?._id || null,
    firstName: employee?.firstName || null,
    lastName: employee?.lastName || null,
    employeeCode: employee?.employeeCode || null,
    managerId: employee?.managerId || null,
    profileImage: employee?.profileImage || null
  };
};


const OTP_EXPIRY_MS = 10 * 60 * 1000;

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * SEND OTP
 */
exports.sendOtp = async ({ email }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw { code: 404, message: "Email not registered" };
  }

  const otp = generateOtp();

  await User.updateOne(
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
  const user = await User.findOne({ email });
  if (!user) throw { code: 404, message: "User not found" };

  if (user.otp !== otp) {
    user.otpAttempts += 1;
    await user.save();
    throw { code: 400, message: "Invalid OTP" };
  }

  if (Date.now() - user.otpTimestamp > OTP_EXPIRY_MS) {
    throw { code: 400, message: "OTP expired" };
  }

  await User.updateOne(
    { email },
    { otp: null, otpTimestamp: null, otpAttempts: 0 }
  );
};
