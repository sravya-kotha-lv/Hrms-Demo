const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    code: {
      type: String,
      required: true,
      unique: true
    },

    timezone: {
      type: String,
      required: true
    },

    currency: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    leaveCycleStartMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: 1   // Apr–Mar
    }

  },
  { timestamps: true }
);

module.exports = mongoose.model("organizations", organizationSchema);
