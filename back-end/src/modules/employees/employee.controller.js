const employeeService = require("./employee.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.create = async (req, res) => {
  const data = await employeeService.create(req);
  return res.status(201).json(
    buildSuccessResponse({
      code: 201,
      message: "Employee created successfully",
      data
    })
  );
};

exports.update = async (req, res) => {
  const data = await employeeService.update(req);
  return res.json(
    buildSuccessResponse({
      message: "Employee updated successfully",
      data
    })
  );
};

exports.remove = async (req, res) => {
  await employeeService.remove(req);
  return res.json(
    buildSuccessResponse({
      message: "Employee deleted successfully"
    })
  );
};

exports.list = async (req, res) => {
  const data = await employeeService.list(req);
  return res.json(
    buildSuccessResponse({
      message: "Employees fetched successfully",
      data
    })
  );
};

exports.getById = async (req, res) => {
  const data = await employeeService.getById(req);
  return res.json(
    buildSuccessResponse({
      message: "Employee details fetched successfully",
      data
    })
  );
};

exports.getMe = async (req, res) => {
  const data = await employeeService.getMe(req);
  return res.json(
    buildSuccessResponse({
      message: "My employee profile fetched successfully",
      data
    })
  );
};

exports.restore = async (req, res) => {
  const data = await departmentService.restore(req);
  return res.json(
    buildSuccessResponse({
      message: "Department restored successfully",
      data
    })
  );
};