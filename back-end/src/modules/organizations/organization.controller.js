const service = require("./organization.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.create = async (req, res) => {
  const data = await service.create(req.body);

  res.status(201).json(
    buildSuccessResponse({
      code: 201,
      message: "Organization created successfully",
      data
    })
  );
};

exports.update = async (req, res) => {
  const data = await service.update(req.params.id, req.body);

  res.json(
    buildSuccessResponse({
      message: "Organization updated successfully",
      data
    })
  );
};

exports.getById = async (req, res) => {
  const data = await service.getById(req.params.id);

  res.json(
    buildSuccessResponse({
      data
    })
  );
};

exports.list = async (req, res) => {
  const data = await service.list();

  res.json(
    buildSuccessResponse({
      data
    })
  );
};

exports.deleteById = async (req, res) => {
  await service.deleteById(req.params.id);

  res.json(
    buildSuccessResponse({
      message: "Organization deleted successfully"
    })
  );
};