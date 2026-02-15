const mongoose = require("mongoose");

const timesheetAttendanceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "organizations",
      required: true,
      index: true
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employees",
      required: true,
      index: true
    },

    date: {
      type: Date,
      required: true,
      index: true
    },

    checkInAt: Date,

    checkOutAt: Date,

    totalMinutes: {
      type: Number,
      default: 0
    },

    status: {
      type: String,
      enum: ["checked_in", "checked_out"],
      default: "checked_in"
    },
    overriddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employees",
      default: null
    },
    overriddenAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

timesheetAttendanceSchema.index(
  { organizationId: 1, employeeId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("timesheet_attendance", timesheetAttendanceSchema);
