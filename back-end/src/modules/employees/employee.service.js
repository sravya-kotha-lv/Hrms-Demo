const mongoose = require("mongoose");
const User = require("../users/user.model");
const Employee = require("./employee.model");
const OrganizationService = require('../organizations/organization.service');
const { genHashedPassword } = require("../../utils/bcryptUtils");
const sendMail = require("../../utils/sendMail");

/* ------------------------------------------------------------------ */
/* HR / ADMIN CREATES EMPLOYEE                                         */
/* ------------------------------------------------------------------ */
exports.createByHr = async (req) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      email,
      roleIds,
      firstName,
      lastName,
      employeeCode,
      departmentId,
      designationId,
      dateOfJoining,
      employmentType
    } = req.body;

    const { organizationId } = req.user;

    /* 1️⃣ Prevent duplicate user */
    const existingUser = await User.findOne(
      { email, organizationId },
      null,
      { session }
    );

    if (existingUser) {
      throw { code: 409, message: "User already exists" };
    }

    /* 2️⃣ Generate password */
    const plainPassword = generatePassword();
    const hashedPassword = await genHashedPassword(plainPassword);

    /* 3️⃣ Create USER */
    const [user] = await User.create(
      [
        {
          organizationId,
          email,
          password: hashedPassword,
          roleIds,
          status: "active",
          isFirstLogin: true
        }
      ],
      { session }
    );

    /* 4️⃣ Create EMPLOYEE */
    const [employee] = await Employee.create(
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
          profileCompleted: false
        }
      ],
      { session }
    );

    const orgDetails = await OrganizationService.getOrganizationById(organizationId);
    console.log(orgDetails,"orgs");
    
    await sendMail(
      "employeeOnboarding",                
      firstName,                             
      `Welcome to ${orgDetails?.name}`,      
      {
        employeeName: firstName,
        email,
        password: plainPassword,
        loginUrl: process.env.FRONTEND_LOGIN_URL,
        orgName:orgDetails?.name
      },
      email                                  
    );

    await session.commitTransaction();
    session.endSession();

    return {
      employeeId: employee._id,
      userId: user._id,
      email
    };

  } catch (err) {
    console.log(err,"=======");
    
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

/* ------------------------------------------------------------------ */
/* EMPLOYEE COMPLETES OWN PROFILE                                      */
/* ------------------------------------------------------------------ */
exports.completeMyProfile = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user._id,
    organizationId: req.user.organizationId
  });

  if (!employee) {
    throw { code: 404, message: "Employee record not found" };
  }

  Object.assign(employee, req.body);
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

exports.listByOrganization = async (req) => {
  const {
    page = 1,
    limit = 10,
    search,
    departmentId,
    designationId,
    status
  } = req.query;

  const { organizationId, _id: userId, roleIds } = req.user;

  const query = {
    organizationId,
    isDeleted: false
  };

  /**
   * 👔 Manager scoping
   */
  if (roleIds?.includes("MANAGER_ROLE_ID")) {
    query.managerId = userId;
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
  const { organizationId, _id: userId, roleIds } = req.user;

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
  if (
    roleIds?.length &&
    !req.user.isOrgAdmin && // optional helper flag if you have
    employee.managerId &&
    employee.managerId._id.toString() !== userId.toString()
  ) {
    throw { code: 403, message: "Access denied" };
  }

  return employee;
};

exports.getMe = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user._id,
    organizationId: req.user.organizationId,
    isDeleted: false
  })
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName");

  if (!employee) {
    throw { code: 404, message: "Employee record not found" };
  }

  return employee;
};
