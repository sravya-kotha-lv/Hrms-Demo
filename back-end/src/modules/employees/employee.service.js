const mongoose = require("mongoose");
const User = require("../users/user.model");
const OrgUser = require("../organizations/org-user.model");
const Employee = require("./employee.model");
const OrganizationService = require('../organizations/organization.service');
const Role = require("../roles/role.model");
const { genHashedPassword } = require("../../utils/bcryptUtils");
const sendMail = require("../../utils/sendMail");
const leaveBalanceService =
  require("../leaveBalances/leaveBalance.service");


/* ------------------------------------------------------------------ */
/* HR / ADMIN CREATES EMPLOYEE                                         */
/* ------------------------------------------------------------------ */
exports.createByHr = async (req) => {
  const createFlow = async (options = {}) => {
    const { session } = options;
    const useSession = Boolean(session);

    const {
      email,
      roleIds,
      firstName,
      lastName,
      departmentId,
      designationId,
      dateOfJoining,
      employmentType,
      managerId
    } = req.body;

    const { organizationId } = req.user;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = useSession
      ? await User.findOne({ email: normalizedEmail }, null, { session })
      : await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      throw { code: 409, message: "User already exists" };
    }

    const plainPassword = generatePassword();
    const hashedPassword = await genHashedPassword(plainPassword);

    const [user] = useSession
      ? await User.create(
          [
            {
              organizationIds: [organizationId],
              activeOrganizationId: organizationId,
              email: normalizedEmail,
              password: hashedPassword,
              status: "active"
            }
          ],
          { session }
        )
      : await User.create([
          {
            organizationIds: [organizationId],
            activeOrganizationId: organizationId,
            email: normalizedEmail,
            password: hashedPassword,
            status: "active"
          }
        ]);

    const orgUsers = useSession
      ? await OrgUser.create(
          [
            {
              userId: user._id,
              organizationId,
              roleIds
            }
          ],
          { session }
        )
      : await OrgUser.create([
          {
            userId: user._id,
            organizationId,
            roleIds
          }
        ]);

    const employeeCode = await generateEmployeeCode(
      organizationId,
      useSession ? session : undefined
    );

    const [employee] = useSession
      ? await Employee.create(
          [
            {
              organizationId,
              userId: user._id,
              firstName,
              lastName,
              employeeCode,
              departmentId,
              designationId,
              dateOfJoining,
              employmentType,
              managerId,
              profileCompleted: false
            }
          ],
          { session }
        )
      : await Employee.create([
          {
            organizationId,
            userId: user._id,
            firstName,
            lastName,
            employeeCode,
            departmentId,
            designationId,
            dateOfJoining,
            employmentType,
            managerId,
            profileCompleted: false
          }
        ]);

    await leaveBalanceService.initializeForEmployee(
      employee,
      req.user.organizationId
    );

    const orgDetails = await OrganizationService.getOrganizationById(organizationId);
    await sendMail(
      "employeeOnboarding",
      firstName,
      `Welcome to ${orgDetails?.name}`,
      {
        employeeName: firstName,
        email,
        password: plainPassword,
        loginUrl: process.env.FRONTEND_LOGIN_URL,
        orgName: orgDetails?.name
      },
      email
    );

    return {
      employeeId: employee._id,
      userId: user._id,
      email
    };
  };

  const session = await mongoose.startSession();

  try {
    try {
      session.startTransaction();
      const result = await createFlow({ session });
      await session.commitTransaction();
      session.endSession();
      return result;
    } catch (err) {
      const message = err?.message || "";
      const codeName = err?.codeName || "";
      const isTxnError =
        codeName === "IllegalOperation" ||
        message.includes("Transaction numbers are only allowed");

      if (isTxnError) {
        try {
          await session.abortTransaction();
        } catch (_) {}
        session.endSession();
        return await createFlow({});
      }

      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw err;
    }
  } catch (err) {
    session.endSession();
    throw err;
  }
};

/* ------------------------------------------------------------------ */
/* EMPLOYEE COMPLETES OWN PROFILE                                      */
/* ------------------------------------------------------------------ */
exports.completeMyProfile = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId
  });

  if (!employee) {
    throw { code: 404, message: "Employee record not found. Contact admin." };
  }

  const editableFields = {
    phone: req.body.phone,
    dob: req.body.dob,
    gender: req.body.gender,
    address: req.body.address,
    emergencyContacts: req.body.emergencyContacts
  };
  Object.assign(employee, editableFields);
  employee.profileCompleted = true;

  await employee.save();
  return employee;
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */
function generatePassword() {
  return Math.random().toString(36).slice(-10);
}

async function generateEmployeeCode(organizationId, session) {
  const prefix = (process.env.EMPLOYEE_CODE_PREFIX || "LV").trim() || "LV";
  let sequence = await Employee.countDocuments(
    { organizationId, isDeleted: false },
    { session }
  );

  while (true) {
    sequence += 1;
    const code = `${prefix}-${String(sequence).padStart(4, "0")}`;
    const exists = await Employee.findOne(
      { organizationId, employeeCode: code },
      "_id",
      { session }
    );
    if (!exists) return code;
  }
}

exports.listByOrganization = async (req) => {
  const {
    page = 1,
    limit = 10,
    search,
    departmentId,
    designationId,
    status,
    organizationId: orgIdOverride
  } = req.query;

  const { organizationId, userId, roleIds, activeRoleId } = req.user;
  const isSuperAdmin = await OrganizationService.isUserSuperAdmin(userId);

  let isManager = false;
  if (activeRoleId) {
    const role = await Role.findOne({
      _id: activeRoleId,
      organizationId
    }).select("slug");
    isManager = role?.slug === "manager";
  }

  const query = {
    organizationId: isSuperAdmin && orgIdOverride ? orgIdOverride : organizationId,
    isDeleted: false
  };

  /**
   * 👔 Manager scoping
   */
  if (isManager) {
    const managerEmployee = await Employee.findOne({
      userId,
      organizationId
    }).select("_id");
    if (managerEmployee) {
      query.managerId = managerEmployee._id;
    }
  }

  /* 🔍 Search */
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { employeeCode: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } }
    ];
  }

  /* 🎯 Filters */
  if (departmentId) query.departmentId = departmentId;
  if (designationId) query.designationId = designationId;
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);

  const [employees, total] = await Promise.all([
    Employee.find(query)
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .populate("managerId", "firstName lastName")
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),

    Employee.countDocuments(query)
  ]);

  return {
    items: employees,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
};

exports.getById = async (req) => {
  const { id } = req.params;
  const { organizationId, userId, roleIds, activeRoleId } = req.user;

  const employee = await Employee.findOne({
    _id: id,
    organizationId,
    isDeleted: false
  })
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName")
    .populate("userId", "email");

  if (!employee) {
    throw { code: 404, message: "Employee not found" };
  }

  /**
   * 🔒 Manager scoping:
   * Manager can only view employees who report to them
   */
  if (roleIds?.length && employee.managerId && activeRoleId) {
    const role = await Role.findOne({
      _id: activeRoleId,
      organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId,
        organizationId
      }).select("_id");

      if (
        managerEmployee &&
        employee.managerId._id.toString() !== managerEmployee._id.toString()
      ) {
        throw { code: 403, message: "Access denied" };
      }
    }
  }

  const orgUser = await OrgUser.findOne({
    userId: employee.userId?._id || employee.userId,
    organizationId
  }).populate("roleIds", "name");

  return {
    ...employee.toObject(),
    roleIds: orgUser?.roleIds || []
  };
};

exports.getMe = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user.userId,
    organizationId: req.user.organizationId,
    isDeleted: false
  })
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName");

  if (!employee) {
    const user = await User.findById(req.user.userId).select("email");
    return {
      userId: { email: user?.email || "" },
      firstName: "",
      lastName: "",
      departmentId: null,
      designationId: null,
      employmentType: "",
      dateOfJoining: null,
      managerId: null,
      profileCompleted: false
    };
  }

  return employee;
};

/* ------------------------------------------------------------------ */
/* HR / ADMIN UPDATES EMPLOYEE                                         */
/* ------------------------------------------------------------------ */
exports.updateByHr = async (req) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  const employee = await Employee.findOne({
    _id: id,
    organizationId,
    isDeleted: false
  });

  if (!employee) {
    throw { code: 404, message: "Employee not found" };
  }

  const {
    email,
    roleIds,
    firstName,
    lastName,
    phone,
    employeeCode,
    departmentId,
    designationId,
    dateOfJoining,
    employmentType,
    status,
    managerId,
    dob,
    gender,
    address,
    emergencyContacts
  } = req.body;

  if (employeeCode && employeeCode !== employee.employeeCode) {
    const exists = await Employee.findOne({
      organizationId,
      employeeCode,
      _id: { $ne: employee._id }
    });
    if (exists) {
      throw { code: 409, message: "Employee code already exists" };
    }
  }

  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findById(employee.userId);
    if (!user) {
      throw { code: 404, message: "User not found" };
    }

    if (normalizedEmail !== user.email) {
      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id }
      });
      if (emailExists) {
        throw { code: 409, message: "Email already exists" };
      }
      user.email = normalizedEmail;
      await user.save();
    }
  }

  const updates = {
    firstName,
    lastName,
    phone,
    employeeCode,
    departmentId,
    designationId,
    dateOfJoining,
    employmentType,
    status,
    managerId,
    dob,
    gender,
    address,
    emergencyContacts
  };

  Object.keys(updates).forEach((key) => {
    if (updates[key] !== undefined) {
      employee[key] = updates[key];
    }
  });

  await employee.save();

  if (roleIds?.length) {
    await OrgUser.findOneAndUpdate(
      { userId: employee.userId, organizationId },
      { roleIds },
      { new: true }
    );
  }

  const populatedEmployee = await Employee.findOne({
    _id: employee._id,
    organizationId,
    isDeleted: false
  })
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName")
    .populate("userId", "email");

  const orgUser = await OrgUser.findOne({
    userId: employee.userId,
    organizationId
  }).populate("roleIds", "name");

  return {
    ...populatedEmployee.toObject(),
    roleIds: orgUser?.roleIds || []
  };
};

/* ------------------------------------------------------------------ */
/* HR / ADMIN SOFT DELETE EMPLOYEE                                     */
/* ------------------------------------------------------------------ */
exports.remove = async (req) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  const employee = await Employee.findOne({
    _id: id,
    organizationId,
    isDeleted: false
  });

  if (!employee) {
    throw { code: 404, message: "Employee not found" };
  }

  employee.isDeleted = true;
  employee.deletedAt = new Date();
  employee.deletedBy = req.user.userId;

  await employee.save();
};
