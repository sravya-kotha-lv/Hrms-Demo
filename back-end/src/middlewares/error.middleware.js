module.exports = (err, req, res, next) => {
  console.error("❌ Error:", err);

  let statusCode = err.status || err.code || 500;
  let message = err.message || "Internal Server Error";

  // 🔒 Mongo duplicate key error
  if (err.code === 11000) {
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue || {})[0];
    message = `${field} already exists`;
  }

  // 🧾 Validation errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  }

  // 🚫 Ensure valid HTTP status
  if (statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  res.status(statusCode).json({
    success: false,
    code: statusCode,
    message,
    data: null,
    error: null
  });
};
