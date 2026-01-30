const winston = require("winston");

const { combine, timestamp, printf, colorize } = winston.format;

// Log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    // Console logs
    // new winston.transports.Console({
    //   format: combine(colorize(), logFormat)
    // }),

    // // Error logs
    // new winston.transports.File({
    //   filename: "logs/error.log",
    //   level: "error"
    // }),

    // // All logs
    // new winston.transports.File({
    //   filename: "logs/combined.log"
    // })
  ],
  exceptionHandlers: [
    // new winston.transports.File({ filename: "logs/exceptions.log" })
  ]
});

module.exports = logger;
