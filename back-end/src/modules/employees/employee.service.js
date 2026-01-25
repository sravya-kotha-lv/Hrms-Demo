const Employee = require("./employee.model");
const { audit } = require("../auditLogs/auditLogs.service");

/**
 * CREATE
 */
exports.create = async (req) => {
  const { organizationId } = req.user;

  const exists = await Employee.findOne({
    organizationId,
    employeeCode: req.body.employeeCode
  });

  if (exists) {
    throw { code: 400, message: "Employee code already exists" };
  }

  const employee = await Employee.create({
    ...req.body,
    organizationId
  });

  await audit({
    req,
    module: "employees",
    action: "CREATE",
    entityId: employee._id,
    after: employee.toObject()
  });

  return employee;
};

/**
 * UPDATE
 */
exports.update = async (req) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });

  if (!employee) {
    throw { code: 404, message: "Employee not found" };
  }

  const before = employee.toObject();

  Object.assign(employee, req.body);
  await employee.save();

  await audit({
    req,
    module: "employees",
    action: "UPDATE",
    entityId: employee._id,
    before,
    after: employee.toObject()
  });

  return employee;
};

/**
 * DELETE (SOFT)
 */
exports.remove = async (req) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });

  if (!employee) {
    throw { code: 404, message: "Employee not found" };
  }

  const before = employee.toObject();

  employee.isDeleted = true;
  employee.deletedAt = new Date();
  employee.deletedBy = req.user._id;

  await employee.save();

  await audit({
    req,
    module: "employees",
    action: "DELETE",
    entityId: employee._id,
    before,
    after: employee.toObject()
  });
};

/**
 * LIST
 */
exports.list = async (req) => {
  const {
    page = 1,
    limit = 10,
    search,
    departmentId,
    designationId,
    status
  } = req.query;

  const query = {
    organizationId: req.user.organizationId,
    isDeleted: false
  };

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { employeeCode: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } }
    ];
  }

  if (departmentId) query.departmentId = departmentId;
  if (designationId) query.designationId = designationId;
  if (status) query.status = status;

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
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
    items,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    }
  };
};

exports.getById = async (req) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  })
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName");

  if (!employee) {
    throw { code: 404, message: "Employee not found" };
  }

  return employee;
};

exports.getMe = async (req) => {
  const employee = await Employee.findOne({
    userId: req.user._id,
    organizationId: req.user.organizationId
  })
    .populate("departmentId", "name")
    .populate("designationId", "name")
    .populate("managerId", "firstName lastName");

  if (!employee) {
    throw { code: 404, message: "Employee profile not found" };
  }

  return employee;
};

exports.restore = async (req) => {
  const department = await Department.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
    isDeleted: true
  });

  if (!department) {
    throw { code: 404, message: "Department not found or not deleted" };
  }

  department.isDeleted = false;
  department.deletedAt = null;
  department.deletedBy = null;
  await department.save();

  await audit({
    req,
    module: "departments",
    action: "RESTORE",
    entityId: department._id
  });

  return department;
};