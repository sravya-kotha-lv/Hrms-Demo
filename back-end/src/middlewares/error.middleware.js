const { buildFailureResponse } = require("../utils/responseBuilder");

module.exports = (err, req, res, next) => {
  const status = err.code || 500;
  
  res.status(status).json(
    buildFailureResponse({
      code: status,
      message: err.message || "Internal server error",
      error: err.error || null
    })
  );
};
