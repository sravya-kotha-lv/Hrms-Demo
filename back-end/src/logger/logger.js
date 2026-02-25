const winston = require("winston");

const { combine, timestamp, printf, colorize, errors, splat, metadata, json } =
  winston.format;

// Log format
const devLogFormat = printf(({ level, message, timestamp, stack, metadata: meta }) => {
  const payload = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${payload}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp(),
    errors({ stack: true }),
    splat(),
    metadata({ fillExcept: ["level", "message", "timestamp", "stack"] }),
    process.env.NODE_ENV === "production" ? json() : devLogFormat
  ),
  transports: [
    // Console logs
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === "production"
          ? combine(timestamp(), errors({ stack: true }), splat(), metadata(), json())
          : combine(
              colorize(),
              timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
              errors({ stack: true }),
              splat(),
              metadata({ fillExcept: ["level", "message", "timestamp", "stack"] }),
              devLogFormat
            )
    }),

    // Error logs
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error"
    }),

    // All logs
    new winston.transports.File({
      filename: "logs/combined.log"
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: "logs/exceptions.log" })
  ]
});

module.exports = logger;
