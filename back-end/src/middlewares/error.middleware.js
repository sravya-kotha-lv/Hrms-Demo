module.exports = (err, req, res, next) => {
  console.error("❌ Error:", err);

  const parseStatusCode = (value) => {
    const n = Number(value);
    if (!Number.isInteger(n)) return null;
    if (n < 100 || n > 599) return null;
    return n;
  };

  let statusCode =
    parseStatusCode(err.statusCode) ||
    parseStatusCode(err.status) ||
    parseStatusCode(err.httpStatus) ||
    500;
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

  // PostgreSQL errors (e.g. 42P01 undefined_table, 23505 unique_violation)
  // should not be used as HTTP status codes.
  if (typeof err.code === "string" && /^23\d{3}$/.test(err.code)) {
    statusCode = 409;
  } else if (typeof err.code === "string" && /^22\d{3}$/.test(err.code)) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    code: statusCode,
    message,
    data: null,
    error: null
  });
};
