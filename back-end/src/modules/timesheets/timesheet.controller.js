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

exports.getCheckInPolicy = async (req, res) => {
  const data = await service.getCheckInPolicy(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.myAttendance = async (req, res) => {
  const data = await service.getMyAttendance(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.attendanceList = async (req, res) => {
  const data = await service.getAttendance(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.attendanceMatrix = async (req, res) => {
  const data = await service.getAttendanceMatrix(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.myAttendanceMatrix = async (req, res) => {
  const data = await service.getMyAttendanceMatrix(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.attendanceCellHistory = async (req, res) => {
  const data = await service.getAttendanceCellHistory(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.myAttendanceCellHistory = async (req, res) => {
  const data = await service.getMyAttendanceCellHistory(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.overrideAttendance = async (req, res) => {
  const data = await service.overrideAttendance(req);
  res.status(200).json(buildSuccessResponse({ message: "Attendance updated", data }));
};

exports.bulkOverrideAttendance = async (req, res) => {
  const data = await service.bulkOverrideAttendance(req);
  res.status(200).json(buildSuccessResponse({ message: "Attendance bulk updated", data }));
};

exports.raiseAttendanceRequest = async (req, res) => {
  const data = await service.raiseAttendanceRequest(req);
  res.status(201).json(buildSuccessResponse({ message: "Attendance request raised", data }));
};

exports.myAttendanceRequests = async (req, res) => {
  const data = await service.getMyAttendanceRequests(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.attendanceRequests = async (req, res) => {
  const data = await service.getAttendanceRequests(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.pendingMyAttendanceApprovals = async (req, res) => {
  const data = await service.getMyPendingAttendanceApprovals(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.actionAttendanceRequest = async (req, res) => {
  const data = await service.actionAttendanceRequest(req);
  res.status(200).json(buildSuccessResponse({ message: `Attendance request ${req.body.status}`, data }));
};

exports.online = async (req, res) => {
  const data = await service.getOnline(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.onLeave = async (req, res) => {
  const data = await service.getOnLeave(req);
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

exports.recallWeekly = async (req, res) => {
  const data = await service.recallWeekly(req);
  res.status(200).json(buildSuccessResponse({ message: "Timesheet recalled", data }));
};
