const service = require("./payslip.service");
const { buildSuccessResponse } = require("../../utils/responseBuilder");

exports.getPayslipByRun = async (req, res) => {
  const data = await service.getPayslipByRun(req);
  return res.status(200).json(
    buildSuccessResponse({
      message: "Payslip generated successfully",
      data
    })
  );
};

exports.getPayslipByMonth = async (req, res) => {
  const data = await service.getPayslipByMonth(req);
  return res.status(200).json(
    buildSuccessResponse({
      message: "Monthly payslip fetched successfully",
      data
    })
  );
};
