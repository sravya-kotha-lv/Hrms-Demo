const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
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

    leaveTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "leave_types",
      required: true
    },

    fromDate: {
      type: Date,
      required: true
    },

    toDate: {
      type: Date,
      required: true
    },

    totalDays: {
      type: Number,
      required: true
    },

    reason: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending"
    },

    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employees"
    },

    actionAt: Date,

    rejectionReason: String,

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

leaveSchema.pre(/^find/, function () {
  this.where({ isDeleted: false });
});

module.exports = mongoose.model("leaves", leaveSchema);
