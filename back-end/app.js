const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");

// Load env variables
dotenv.config({ quiet: true });

// App init
const app = express();

/* -------------------------------------------------------------------------- */
/*                                CONFIG                                      */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 8000;

/* -------------------------------------------------------------------------- */
/*                               MIDDLEWARES                                  */
/* -------------------------------------------------------------------------- */

// Parse JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:3001",
  "https://upanaya.vercel.app"
];
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = "CORS policy does not allow this origin: " + origin;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: "Content-Type,Authorization,Access-Control-Allow-Credentials",
    exposedHeaders: "Content-Type,Authorization,Access-Control-Allow-Credentials",
    credentials: true,
  })
);
// HTTP request logging (dev)
app.use(morgan("dev"));

// Custom request logger (audit / tracing)
// const requestLogger = require("./src/middlewares/requestLogger");
// app.use(requestLogger);

// Rate limiting
// const rateLimiter = require("./src/middlewares/rateLimiter");
// app.use(rateLimiter);

/* -------------------------------------------------------------------------- */
/*                               SWAGGER                                      */
/* -------------------------------------------------------------------------- */

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

app.use("/swagger-ui", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* -------------------------------------------------------------------------- */
/*                               ROUTES                                       */
/* -------------------------------------------------------------------------- */

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use("/api/users", require("./src/modules/users/user.routes"));
app.use("/api/organizations", require("./src/modules/organizations/organization.routes"));
app.use("/api/roles", require("./src/modules/roles/role.routes"));
app.use("/api/employees", require("./src/modules/employees/employee.routes"));
app.use("/api/departments", require("./src/modules/departments/department.routes"));
app.use("/api/designations", require("./src/modules/designations/designation.routes"));
app.use("/api/leave-types", require("./src/modules/leaveTypes/leaveType.routes"));
app.use("/api/leaves", require("./src/modules/leaves/leave.routes"));
app.use("/api/holidays", require("./src/modules/holidays/holiday.routes"));
app.use("/api/week-offs", require("./src/modules/weekOffs/weekOff.routes"));
app.use("/api/leave-balances", require("./src/modules/leaveBalances/leaveBalance.routes"));
 

/* ----------------------JOBS----------------*/
require("./src/jobs/leaveCarryForward.job");

/* ----------------------JOBS----------------*/



/* -------------------------------------------------------------------------- */
/*                         GLOBAL ERROR HANDLER                                */
/* -------------------------------------------------------------------------- */

const errorMiddleware = require("./src/middlewares/error.middleware");
app.use(errorMiddleware);

/* -------------------------------------------------------------------------- */
/*                            DATABASE + SERVER                                */
/* -------------------------------------------------------------------------- */

const connectDB = require("./src/config/db");

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📄 Swagger docs: http://localhost:${PORT}/swagger-ui`);
  });
};

startServer();

process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION");
  console.error(err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION");
  console.error(reason);
});

module.exports = app;
