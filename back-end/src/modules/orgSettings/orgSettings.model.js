const mongoose = require("mongoose");

const orgSettingsSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "organizations",
      required: true,
      unique: true,
      index: true
    },

    leaveCreditFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      default: "monthly"
    },
    leaveTypeCreditMode: {
      type: String,
      enum: ["current_month_onwards", "full_year"],
      default: "current_month_onwards"
    },
    sandwichRuleEnabled: {
      type: Boolean,
      default: false
    },
    attendanceLockEnabled: {
      type: Boolean,
      default: false
    },
    attendanceLockAfterDays: {
      type: Number,
      default: 7
    },
    attendanceLockMode: {
      type: String,
      enum: ["days_window", "payroll_cutoff"],
      default: "days_window"
    },
    timezone: {
      type: String,
      default: "UTC"
    },
    payrollCutoffDay: {
      type: Number,
      default: 25
    },

    minWorkHoursPerDay: {
      type: Number,
      default: 8
    },

    minHalfDayHours: {
      type: Number,
      default: 4
    },
    probationPeriodDays: {
      type: Number,
      default: 90,
      min: 0
    },
    noticePeriodDays: {
      type: Number,
      default: 30,
      min: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("orgSettings", orgSettingsSchema, "org_settings");
