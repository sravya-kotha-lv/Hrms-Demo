const departmentService = require("./department.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.create = async (req, res) => {
  try {
  const data = await departmentService.create(req);
  res.status(201).json(
    buildSuccessResponse({
      message: "Department created successfully",
      data
    })
  );
} catch (error) {
  res.status(500).json(
    buildSuccessResponse({
      message: "Error creating department",
      error: error.message
    })
  );
};
}

exports.update = async (req, res) => {
  const data = await departmentService.update(req);
  res.json(
    buildSuccessResponse({
      message: "Department updated successfully",
      data
    })
  );
};

exports.remove = async (req, res) => {
  await departmentService.remove(req);
  res.json(
    buildSuccessResponse({
      message: "Department deleted successfully"
    })
  );
};

exports.list = async (req, res) => {
  const data = await departmentService.list(req);
  res.json(
    buildSuccessResponse({
      message: "Departments fetched successfully",
      data
    })
  );
};
