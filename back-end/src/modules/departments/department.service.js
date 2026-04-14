const Department = require("./department.model");
const Employee = require("../employees/employee.model");
const OrganizationService = require("../organizations/organization.service");
const { audit } = require("../auditLogs/auditLogs.service");

exports.create = async (req) => {
  try {
    let { organizationId, managerId } = req.body;
    if (!organizationId) {
      organizationId = req.user.organizationId;
    }
    if (!managerId) {
      const employee = await Employee.findOne({
        userId: req.user.userId,
        organizationId
      }).select("_id");
      if (employee) managerId = employee._id;
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
  const filter = {
    _id: req.params.id,
    organizationId: req.user.organizationId
  };
  const before = await Department.collection.findOne(filter);

  if (!before) {
    throw { code: 404, message: "Department not found" };
  }

  const updateDoc = { ...req.body };
  if (updateDoc.status === "active") {
    updateDoc.isDeleted = false;
    updateDoc.deletedAt = null;
    updateDoc.deletedBy = null;
  }

  await Department.updateOne(filter, { $set: updateDoc });
  const department = await Department.collection.findOne(filter);

  await audit({
    req,
    module: "departments",
    action: "UPDATE",
    entityId: before._id,
    before,
    after: department
  });

  return department;
};

exports.remove = async (req) => {
  const department = await Department.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
    isDeleted: false
  });

  if (!department) {
    throw { code: 404, message: "Department not found" };
  }

  const before = department.toObject();

  department.status = "inactive";
  await department.save();

  await audit({
    req,
    module: "departments",
    action: "DELETE",
    entityId: department._id,
    before,
    after: department.toObject()
  });
};

exports.list = async (req) => {
  const isSuperAdmin = await OrganizationService.isUserSuperAdmin(req.user.userId);
  const requestedOrgId = req.query.organizationId;
  const organizationId = isSuperAdmin && requestedOrgId ? requestedOrgId : req.user.organizationId;
  const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "true";
  const match = {
    organizationId
  };

  if (!includeInactive) {
    match.isDeleted = false;
    match.status = "active";
  }

  const departments = await Department.aggregate([
    { $match: match },
    {
      $addFields: {
        status: {
          $cond: [{ $eq: ["$isDeleted", true] }, "inactive", "$status"]
        }
      }
    },
    {
      $sort: {
        status: 1,
        name: 1
      }
    }
  ]);

  return departments;
};
