const Department = require("./department.model");
const { audit } = require("../auditLogs/auditLogs.service");

exports.create = async (req) => {
  try {
    let { organizationId, managerId } = req.body;
    if (!organizationId) {
      organizationId = req.user.organizationId;
    }
    if (!managerId) {
      managerId = req.user._id;
    }

    const exists = await Department.findOne({
      organizationId,
      code: req.body.code
    });

    if (exists) {
      throw { code: 400, message: "Department code already exists" };
    }

    const department = await Department.create({
      ...req.body,
      organizationId,
      managerId
    });

    await audit({
      req,
      module: "departments",
      action: "CREATE",
      entityId: department._id,
      before: null,
      after: department.toObject()
    });
    
    return department;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

exports.update = async (req) => {
  const department = await Department.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });

  if (!department) {
    throw { code: 404, message: "Department not found" };
  }

  const before = department.toObject();
  Object.assign(department, req.body);
  await department.save();

  await audit({
    req,
    module: "departments",
    action: "UPDATE",
    entityId: department._id,
    before,
    after: department.toObject()
  });

  return department;
};

exports.remove = async (req) => {
  const department = await Department.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });

  if (!department) {
    throw { code: 404, message: "Department not found" };
  }

  const before = department.toObject();

  department.isDeleted = true;
  department.deletedAt = new Date();
  department.deletedBy = req.user._id;
  await department.save();

  // await audit({
  //   req,
  //   module: "departments",
  //   action: "DELETE",
  //   entityId: department._id,
  //   before,
  //   after: department.toObject()
  // });
};

exports.list = async (req) => {
  return Department.find({
    organizationId: req.user.organizationId
  }).sort({ name: 1 });
};
