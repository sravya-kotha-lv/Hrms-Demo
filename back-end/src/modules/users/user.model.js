const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "organizations",
      required: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    roleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "roles",
        required: true
      }
    ],

    otp: String,
    otpTimestamp: Date,
    otpAttempts: {
      type: Number,
      default: 0
    },

    tokenList: [
      {
        token: String,
        loginTimestamp: String,
        logoutTimestamp: String,
        status: String,
        reason: String
      }
    ],

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active"
    },

    lastLoginAt: Date
  },
  { timestamps: true }
);

userSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true }
);

module.exports = mongoose.model("users", userSchema);
