const service = require("./employee.service");
const { getEmployeeleaves } = require("../leaveTypes/leaveType.service")
const { buildSuccessResponse } = require("../../utils/responseBuilder");

/**
 * HR / Admin creates employee
 */
exports.createByHr = async (req, res) => {
  const data = await service.createByHr(req);

  res.status(201).json(
    buildSuccessResponse({
      message: "Employee created and onboarding email sent",
      data
    })
  );
};

/**
 * Employee completes profile (first login)
 */
exports.completeMyProfile = async (req, res) => {
  const data = await service.completeMyProfile(req);

  res.json(
    buildSuccessResponse({
      message: "Profile completed successfully",
      data
    })
  );
};

exports.listByOrganization = async (req, res) => {
  const data = await service.listByOrganization(req);

  res.json(
    buildSuccessResponse({
      message: "Employees fetched successfully",
      data
    })
  );
};

exports.getEmployeeleaves = async (req, res) => {
  const data = await getEmployeeleaves(req);
  return res.status(200).json(buildSuccessResponse({ data }));
}

exports.getById = async (req, res) => {
  const data = await service.getById(req);

  res.json(
    buildSuccessResponse({
      message: "Employee fetched successfully",
      data
    })
  );
};

exports.getMe = async (req, res) => {
  const data = await service.getMe(req);

  res.json(
    buildSuccessResponse({
      message: "Profile fetched successfully",
      data
    })
  );
};
