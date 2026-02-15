const service = require("./expense.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.create = async (req, res) => {
  const data = await service.createExpense(req);
  res.status(201).json(buildSuccessResponse({ message: "Expense created", data }));
};

exports.list = async (req, res) => {
  const data = await service.listExpenses(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.summary = async (req, res) => {
  const data = await service.getSummary(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.update = async (req, res) => {
  const data = await service.updateExpense(req);
  res.status(200).json(buildSuccessResponse({ message: "Expense updated", data }));
};

exports.remove = async (req, res) => {
  const data = await service.removeExpense(req);
  res.status(200).json(buildSuccessResponse({ message: "Expense deleted", data }));
};

exports.restore = async (req, res) => {
  const data = await service.restoreExpense(req);
  res.status(200).json(buildSuccessResponse({ message: "Expense restored", data }));
};

exports.action = async (req, res) => {
  const data = await service.actionExpense(req);
  res.status(200).json(buildSuccessResponse({ message: `Expense ${req.body.status}`, data }));
};

exports.uploadReceipt = async (req, res) => {
  const data = await service.uploadReceipt(req);
  res.status(200).json(buildSuccessResponse({ message: "Receipt uploaded", data }));
};

exports.listVendors = async (req, res) => {
  const data = await service.listVendors(req);
  res.status(200).json(buildSuccessResponse({ data }));
};

exports.createVendor = async (req, res) => {
  const data = await service.createVendor(req);
  res.status(201).json(buildSuccessResponse({ message: "Vendor created", data }));
};

exports.updateVendor = async (req, res) => {
  const data = await service.updateVendor(req);
  res.status(200).json(buildSuccessResponse({ message: "Vendor updated", data }));
};

exports.removeVendor = async (req, res) => {
  const data = await service.removeVendor(req);
  res.status(200).json(buildSuccessResponse({ message: "Vendor deleted", data }));
};
