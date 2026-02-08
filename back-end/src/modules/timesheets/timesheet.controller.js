const service = require("./timesheet.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.checkIn = async (req, res) => {
  const data = await service.checkIn(req);
  res.status(201).json(buildSuccessResponse({ message: "Checked in", data }));
};

exports.checkOut = async (req, res) => {
  const data = await service.checkOut(req);
  res.status(200).json(buildSuccessResponse({ message: "Checked out", data }));
};

exports.myAttendance = async (req, res) => {
  const data = await service.getMyAttendance(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.attendanceList = async (req, res) => {
  const data = await service.getAttendance(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.online = async (req, res) => {
  const data = await service.getOnline(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.createWeekly = async (req, res) => {
  const data = await service.createWeekly(req);
  res.status(201).json(buildSuccessResponse({ message: "Timesheet created", data }));
};

exports.updateWeekly = async (req, res) => {
  const data = await service.updateWeekly(req);
  res.status(200).json(buildSuccessResponse({ message: "Timesheet updated", data }));
};

exports.submitWeekly = async (req, res) => {
  const data = await service.submitWeekly(req);
  res.status(200).json(buildSuccessResponse({ message: "Timesheet submitted", data }));
};

exports.myWeekly = async (req, res) => {
  const data = await service.getMyWeekly(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.listWeekly = async (req, res) => {
  const data = await service.getAllWeekly(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.actionWeekly = async (req, res) => {
  const data = await service.actionWeekly(req);
  res.status(200).json(buildSuccessResponse({ message: req.body.status, data }));
};
