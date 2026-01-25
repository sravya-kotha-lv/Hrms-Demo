const rateLimit = require("express-rate-limit");

/**
 * Public APIs (login, register, otp, etc.)
 */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: "Too many requests. Try again later.",
    data: null,
    error: null
  }
});

/**
 * Authenticated APIs (normal app usage)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  publicLimiter,
  authLimiter
};
