const service = require("./leave.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.apply = async (req, res) => {
  console.log(req.user);
  const data = await service.applyLeave(req);
  res.status(201).json(
    buildSuccessResponse({ message: "Leave applied" })
  );
};

exports.myLeaves = async (req, res) => {
  const data = await service.getMyLeaves(req);
  res.status(200).json(
    buildSuccessResponse({ data })
  );
};

exports.list = async (req, res) => {
  const data = await service.getAllLeaves(req);
  res.status(200).json(
    buildSuccessResponse({ data })
  );
};

exports.action = async (req, res) => {
  const data = await service.actionLeave(req);
  res.status(200).json(
    buildSuccessResponse({ message: req.body.status })
  );
};
