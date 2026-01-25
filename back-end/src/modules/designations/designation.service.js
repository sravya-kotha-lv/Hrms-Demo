const Designation = require("./designation.model");
const { audit } = require("../auditLogs/auditLogs.service");

exports.create = async (req) => {
  const designation = await Designation.create({
    ...req.body,
    organizationId: req.user.organizationId
  });

  await audit({
    req,
    module: "designations",
    action: "CREATE",
    entityId: designation._id,
    after: designation.toObject()
  });

  return designation;
};

exports.update = async (req) => {
  const designation = await Designation.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });

  if (!designation) {
    throw { code: 404, message: "Designation not found" };
  }

  const before = designation.toObject();
  Object.assign(designation, req.body);
  await designation.save();

  await audit({
    req,
    module: "designations",
    action: "UPDATE",
    entityId: designation._id,
    before,
    after: designation.toObject()
  });

  return designation;
};

exports.remove = async (req) => {
  const designation = await Designation.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });

  if (!designation) {
    throw { code: 404, message: "Designation not found" };
  }

  designation.isDeleted = true;
  designation.deletedAt = new Date();
  designation.deletedBy = req.user._id;
  await designation.save();

  await audit({
    req,
    module: "designations",
    action: "DELETE",
    entityId: designation._id
  });
};

exports.list = async (req) => {
  return Designation.find({
    organizationId: req.user.organizationId
  }).sort({ level: 1, name: 1 });
};
