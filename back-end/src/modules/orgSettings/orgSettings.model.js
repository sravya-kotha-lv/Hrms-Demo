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

    minWorkHoursPerDay: {
      type: Number,
      default: 8
    },

    minHalfDayHours: {
      type: Number,
      default: 4
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("orgSettings", orgSettingsSchema, "org_settings");
