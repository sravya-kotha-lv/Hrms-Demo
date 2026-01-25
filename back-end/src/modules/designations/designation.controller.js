const service = require("./designation.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.create = async (req, res) => {
  const data = await service.create(req);
  res.status(201).json(buildSuccessResponse({ message: "Designation created", data }));
};

exports.update = async (req, res) => {
  const data = await service.update(req);
  res.json(buildSuccessResponse({ message: "Designation updated", data }));
};

exports.remove = async (req, res) => {
  await service.remove(req);
  res.json(buildSuccessResponse({ message: "Designation deleted" }));
};

exports.list = async (req, res) => {
  const data = await service.list(req);
  res.json(buildSuccessResponse({ message: "Designations fetched", data }));
};
