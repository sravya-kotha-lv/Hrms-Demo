const mongoose = require("mongoose");
const User = require("../users/user.model");
const OrgUser = require("../organizations/org-user.model");
const Employee = require("./employee.model");
const OrganizationService = require('../organizations/organization.service');
const Role = require("../roles/role.model");
const OrgSettings = require("../orgSettings/orgSettings.model");
const { genHashedPassword } = require("../../utils/bcryptUtils");
const sendMail = require("../../utils/sendMail");
const leaveBalanceService =
  require("../leaveBalances/leaveBalance.service");
const { createNotificationSafe } = require("../notifications/notification.service");
const { uploadDataUri } = require("../../config/cloudinary");

const DEFAULT_PROBATION_DAYS = 90;
const DEFAULT_NOTICE_DAYS = 30;
const LIFECYCLE_ACTION_ROLE_SLUGS = new Set([
  "teamlead",
  "team-lead",
  "team_lead",
  "lead",
  "manager",
  "hr",
  "admin",
  "org-admin",
  "super_admin",
  "superadmin"
]);

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
      managerId,
      shiftId
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
    const orgSettings = useSession
      ? await OrgSettings.findOne({ organizationId }, null, { session })
      : await OrgSettings.findOne({ organizationId });
    const lifecyclePayload = buildProbationLifecyclePayload({
      dateOfJoining,
      probationPeriodDays: orgSettings?.probationPeriodDays,
      noticePeriodDays: orgSettings?.noticePeriodDays
    });

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
              shiftId: shiftId || undefined,
              profileCompleted: false,
              ...lifecyclePayload
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
            shiftId: shiftId || undefined,
            profileCompleted: false,
            ...lifecyclePayload
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

  if (req.body.profileImageUpload?.base64Data && req.body.profileImageUpload?.mimeType) {
    const imageDataUri = `data:${req.body.profileImageUpload.mimeType};base64,${req.body.profileImageUpload.base64Data}`;
    const uploadedImage = await uploadDataUri(imageDataUri, {
      folder: "hrms/employee-profile-images"
    });
    editableFields.profileImage = uploadedImage?.secure_url || null;
  }

  if (req.body.addressProofUpload?.base64Data && req.body.addressProofUpload?.mimeType) {
    const proofDataUri = `data:${req.body.addressProofUpload.mimeType};base64,${req.body.addressProofUpload.base64Data}`;
    const uploadedProof = await uploadDataUri(proofDataUri, {
      folder: "hrms/employee-address-proofs"
    });
    editableFields.addressProof = {
      fileName: req.body.addressProofUpload.fileName || "address-proof",
      fileUrl: uploadedProof?.secure_url || "",
      mimeType: req.body.addressProofUpload.mimeType || "",
      uploadedAt: new Date()
    };
  }

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

const addDays = (value, days) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
};

const normalizeNonNegativeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const buildProbationLifecyclePayload = ({
  dateOfJoining,
  probationPeriodDays,
  noticePeriodDays
}) => {
  const joiningDate = new Date(dateOfJoining);
  const probationDays = normalizeNonNegativeNumber(
    probationPeriodDays,
    DEFAULT_PROBATION_DAYS
  );
  const noticeDays = normalizeNonNegativeNumber(
    noticePeriodDays,
    DEFAULT_NOTICE_DAYS
  );

  return {
    employmentLifecycleStatus: "probation",
    probationPeriodDays: probationDays,
    probationStartDate: joiningDate,
    probationEndDate: addDays(joiningDate, probationDays),
    probationCompletedAt: null,
    probationCompletionNotifiedAt: null,
    noticePeriodDays: noticeDays,
    noticeStartDate: null,
    noticeEndDate: null,
    benefitsEligible: false
  };
};

const applyLifecycleChange = (employee, nextLifecycleStatus) => {
  if (!nextLifecycleStatus) return;

  const now = new Date();
  const noticeDays = normalizeNonNegativeNumber(
    employee.noticePeriodDays,
    DEFAULT_NOTICE_DAYS
  );

  if (nextLifecycleStatus === "probation") {
    const probationDays = normalizeNonNegativeNumber(
      employee.probationPeriodDays,
      DEFAULT_PROBATION_DAYS
    );
    const baseStartDate = employee.probationStartDate || employee.dateOfJoining || now;
    employee.employmentLifecycleStatus = "probation";
    employee.probationPeriodDays = probationDays;
    employee.probationStartDate = new Date(baseStartDate);
    employee.probationEndDate = addDays(baseStartDate, probationDays);
    employee.probationCompletedAt = null;
    employee.probationCompletionNotifiedAt = null;
    employee.noticeStartDate = null;
    employee.noticeEndDate = null;
    employee.benefitsEligible = false;
    return;
  }

  if (nextLifecycleStatus === "confirmed") {
    employee.employmentLifecycleStatus = "confirmed";
    employee.probationCompletedAt = employee.probationCompletedAt || now;
    employee.noticeStartDate = null;
    employee.noticeEndDate = null;
    employee.benefitsEligible = true;
    return;
  }

  if (nextLifecycleStatus === "notice") {
    employee.employmentLifecycleStatus = "notice";
    employee.noticePeriodDays = noticeDays;
    employee.noticeStartDate = now;
    employee.noticeEndDate = addDays(now, noticeDays);
    employee.benefitsEligible = false;
    return;
  }

  if (nextLifecycleStatus === "terminated") {
    employee.employmentLifecycleStatus = "terminated";
    employee.noticeStartDate = null;
    employee.noticeEndDate = null;
    employee.benefitsEligible = false;
  }
};

const getActorRoleSlug = async (req) => {
  if (!req.user.activeRoleId) return "";

  const scopedRole = await Role.findOne({
    _id: req.user.activeRoleId,
    organizationId: req.user.organizationId
  }).select("slug");

  if (scopedRole?.slug) return scopedRole.slug;

  const fallbackRole = await Role.findById(req.user.activeRoleId).select("slug");
  return fallbackRole?.slug || "";
};

const buildEmployeeResponse = async ({ employeeId, organizationId }) => {
  const populatedEmployee = await Employee.findOne({
    _id: employeeId,
    organizationId,
    isDeleted: false
  })
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName")
    .populate("shiftId", "name code startTime endTime graceMinutes status")
    .populate("userId", "email");

  const orgUser = await OrgUser.findOne({
    userId: populatedEmployee.userId?._id || populatedEmployee.userId,
    organizationId
  }).populate("roleIds", "name");

  return {
    ...populatedEmployee.toObject(),
    roleIds: orgUser?.roleIds || []
  };
};

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
    page,
    limit,
    search,
    departmentId,
    designationId,
    status,
    organizationId: orgIdOverride
  } = req.query;

  const { organizationId, userId, activeRoleId } = req.user;
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

  /* 👔 Manager scoping */
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

  // Build query
  let employeeQuery = Employee.find(query)
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName")
    .populate("shiftId", "name code startTime endTime graceMinutes status")
    .populate("userId", "email")
    .sort({ createdAt: -1 });

  let total = await Employee.countDocuments(query);

  let pagination = null;

  // ✅ Apply pagination only if BOTH page and limit exist
  if (page && limit) {
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    employeeQuery = employeeQuery.skip(skip).limit(limitNum);

    pagination = {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }

  const employees = await employeeQuery;

  return {
    items: employees,
    pagination // will be null if not paginated
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
    .populate("shiftId", "name code startTime endTime graceMinutes status")
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
    .populate("userId", "email")
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName")
    .populate("shiftId", "name code startTime endTime graceMinutes status");

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
      shiftId: null,
      profileCompleted: false,
      profileImage: null,
      addressProof: null
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
    employmentLifecycleStatus,
    managerId,
    shiftId,
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

  if (dateOfJoining !== undefined && employee.employmentLifecycleStatus === "probation") {
    const probationDays = normalizeNonNegativeNumber(
      employee.probationPeriodDays,
      DEFAULT_PROBATION_DAYS
    );
    employee.probationStartDate = new Date(dateOfJoining);
    employee.probationEndDate = addDays(dateOfJoining, probationDays);
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
    shiftId,
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

  if (employmentLifecycleStatus !== undefined) {
    applyLifecycleChange(employee, employmentLifecycleStatus);
  }

  if (status === "resigned") {
    applyLifecycleChange(employee, "notice");
  }

  if (employee.employmentLifecycleStatus === "terminated") {
    employee.status = "resigned";
  }

  await employee.save();

  if (roleIds?.length) {
    await OrgUser.findOneAndUpdate(
      { userId: employee.userId, organizationId },
      { roleIds },
      { new: true }
    );
  }

  return buildEmployeeResponse({
    employeeId: employee._id,
    organizationId
  });
};

exports.lifecycleAction = async (req) => {
  const { id } = req.params;
  const { organizationId, userId } = req.user;
  const { action, reason } = req.body;

  const employee = await Employee.findOne({
    _id: id,
    organizationId,
    isDeleted: false
  });

  if (!employee) {
    throw { code: 404, message: "Employee not found" };
  }

  const actorRoleSlug = await getActorRoleSlug(req);
  if (!LIFECYCLE_ACTION_ROLE_SLUGS.has(actorRoleSlug)) {
    throw { code: 403, message: "Only team lead, manager, HR, or admin can update employee lifecycle" };
  }

  if (actorRoleSlug === "manager") {
    const managerEmployee = await Employee.findOne({
      userId,
      organizationId,
      isDeleted: false
    }).select("_id");

    if (!managerEmployee) {
      throw { code: 403, message: "Access denied" };
    }

    if (String(employee.managerId || "") !== String(managerEmployee._id)) {
      throw { code: 403, message: "Managers can only action direct reports" };
    }
  }

  if (action === "confirm") {
    applyLifecycleChange(employee, "confirmed");
    employee.status = "active";
  } else if (action === "terminate_with_notice") {
    applyLifecycleChange(employee, "notice");
    employee.status = "resigned";
  } else {
    applyLifecycleChange(employee, "terminated");
    employee.status = "resigned";
  }

  await employee.save();

  const actorEmployee = await Employee.findOne({
    userId,
    organizationId,
    isDeleted: false
  }).select("firstName lastName");
  const actorName = actorEmployee
    ? `${actorEmployee.firstName || ""} ${actorEmployee.lastName || ""}`.trim() || "Management"
    : "Management";

  await createNotificationSafe({
    organizationId,
    recipientUserId: employee.userId,
    recipientEmployeeId: employee._id,
    actorEmployeeId: actorEmployee?._id || null,
    type: "employee_lifecycle",
    title: "Employment lifecycle updated",
    message: `${actorName} marked your employment status as ${employee.employmentLifecycleStatus}.`,
    meta: {
      action,
      reason: reason || "",
      employmentLifecycleStatus: employee.employmentLifecycleStatus
    }
  });

  return buildEmployeeResponse({
    employeeId: employee._id,
    organizationId
  });
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

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const getNextOccurrence = (baseDate, fromDate) => {
  const month = baseDate.getMonth();
  const day = baseDate.getDate();
  let year = fromDate.getFullYear();

  // Handle Feb 29 birthdays/anniversaries in non-leap years as Feb 28
  let targetDay = day;
  if (month === 1 && day === 29 && !isLeapYear(year)) {
    targetDay = 28;
  }

  let next = new Date(year, month, targetDay);
  if (next < fromDate) {
    year += 1;
    targetDay = day;
    if (month === 1 && day === 29 && !isLeapYear(year)) {
      targetDay = 28;
    }
    next = new Date(year, month, targetDay);
  }

  return next;
};

exports.getUpcomingEvents = async (req) => {
  const days = Math.min(31, Math.max(1, Number(req.query.days || 7)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  const query = {
    organizationId: req.user.organizationId,
    isDeleted: false,
    status: { $ne: "resigned" }
  };

  if (req.user.activeRoleId) {
    const role = await Role.findOne({
      _id: req.user.activeRoleId,
      organizationId: req.user.organizationId
    }).select("slug");

    if (role?.slug === "manager") {
      const managerEmployee = await Employee.findOne({
        userId: req.user.userId,
        organizationId: req.user.organizationId
      }).select("_id");

      if (managerEmployee) {
        query.managerId = managerEmployee._id;
      }
    }
  }

  const employees = await Employee.find(query)
    .select("firstName lastName employeeCode dob dateOfJoining");

  const birthdays = [];
  const anniversaries = [];

  for (const e of employees) {
    const name = `${e.firstName || ""} ${e.lastName || ""}`.trim();

    if (e.dob) {
      const dob = new Date(e.dob);
      const nextBirthday = getNextOccurrence(dob, today);
      if (nextBirthday >= today && nextBirthday <= end) {
        const diffDays = Math.floor((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        birthdays.push({
          employeeId: e._id,
          employeeCode: e.employeeCode,
          firstName: e.firstName,
          lastName: e.lastName,
          name,
          eventDate: nextBirthday,
          daysAway: diffDays
        });
      }
    }

    if (e.dateOfJoining) {
      const doj = new Date(e.dateOfJoining);
      const nextAnniversary = getNextOccurrence(doj, today);
      if (nextAnniversary >= today && nextAnniversary <= end) {
        const diffDays = Math.floor((nextAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const years = nextAnniversary.getFullYear() - doj.getFullYear();
        anniversaries.push({
          employeeId: e._id,
          employeeCode: e.employeeCode,
          firstName: e.firstName,
          lastName: e.lastName,
          name,
          eventDate: nextAnniversary,
          daysAway: diffDays,
          years
        });
      }
    }
  }

  birthdays.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  anniversaries.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  return {
    windowDays: days,
    birthdays,
    anniversaries
  };
};
