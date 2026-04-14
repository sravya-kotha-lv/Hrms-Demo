const Designation = require("./designation.model");
const { audit } = require("../auditLogs/auditLogs.service");
const mongoose = require("mongoose");

exports.create = async (req) => {
  try {
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
  } catch (error) {
    throw error;
  }
};

exports.update = async (req) => {
  const filter = {
    _id: req.params.id,
    organizationId: req.user.organizationId
  };
  const before = await Designation.collection.findOne(filter);

  if (!before) {
    throw { code: 404, message: "Designation not found" };
  }

  const updateDoc = { ...req.body };
  if (updateDoc.status === "active") {
    updateDoc.isDeleted = false;
    updateDoc.deletedAt = null;
    updateDoc.deletedBy = null;
  }

  await Designation.updateOne(filter, { $set: updateDoc });
  const [designation] = await Designation.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.params.id),
        organizationId: new mongoose.Types.ObjectId(req.user.organizationId)
      }
    },
    {
      $lookup: {
        from: "departments",
        localField: "departmentId",
        foreignField: "_id",
        as: "departments"
      }
    },
    {
      $unwind: {
        path: "$departments",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        organizationId: 1,
        name: 1,
        departmentId: 1,
        status: 1,
        isDeleted: 1,
        createdAt: 1,
        updatedAt: 1,
        departmentName: "$departments.name"
      }
    }
  ]);

  await audit({
    req,
    module: "designations",
    action: "UPDATE",
    entityId: before._id,
    before,
    after: designation
  });

  return designation;
};

exports.remove = async (req) => {
  const designation = await Designation.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
    isDeleted: false
  });

  if (!designation) {
    throw { code: 404, message: "Designation not found" };
  }

  const before = designation.toObject();
  designation.status = "inactive";
  await designation.save();

  await audit({
    req,
    module: "designations",
    action: "DELETE",
    entityId: designation._id,
    before,
    after: designation.toObject()
  });
};

exports.list = async (req) => {
  try{
    const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "true";
    const matchStage = {
      organizationId: new mongoose.Types.ObjectId(req.user.organizationId)
    };

    if (req.query.departmentId && mongoose.Types.ObjectId.isValid(req.query.departmentId)) {
      matchStage.departmentId = new mongoose.Types.ObjectId(req.query.departmentId);
    }

    if (!includeInactive) {
      matchStage.isDeleted = false;
      matchStage.status = "active";
    }

    const results = await Designation.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'departments',
          localField: 'departmentId',
          foreignField: '_id',
          as: 'departments'
        }
      },
      {
        $unwind: {
          path: '$departments',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          organizationId: 1,
          name: 1,
          departmentId: 1,
          status: {
            $cond: [{ $eq: ["$isDeleted", true] }, "inactive", "$status"]
          },
          isDeleted: 1,
          createdAt: 1,
          updatedAt: 1,
          departmentName: '$departments.name'
        }
      },
      {
        $sort: {
          status: 1,
          name: 1,
          departmentName: 1
        }
      }
    ]);
  
  return results;
} catch(err){
  throw err;
}
};
