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

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

/* -------------------------------------------------------------------------- */
/*                               MIDDLEWARES                                  */
/* -------------------------------------------------------------------------- */

// Parse JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors());

// HTTP request logging (dev)
app.use(morgan("dev"));

// Custom request logger (audit / tracing)
const requestLogger = require("./src/middlewares/requestLogger");
app.use(requestLogger);

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
// app.use("/api/employees", require("./src/modules/employees/employee.routes"));
app.use("/api/departments", require("./src/modules/departments/department.routes"));
// app.use("/api/designations", require("./modules/designations/designation.routes"));
// add more modules here...

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
