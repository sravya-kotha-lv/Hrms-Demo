const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    organizationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "organizations"
      }
    ],

    activeOrganizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "organizations"
    },

    otp: String,
    otpTimestamp: Date,
    otpAttempts: { type: Number, default: 0 },
    resetPasswordVerifiedAt: Date,
    resetPasswordVerifiedUntil: Date,

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

module.exports = mongoose.model("users", userSchema);
