const mongoose = require("mongoose");

const approvalStepSchema = new mongoose.Schema(
  {
    stepNumber: Number,
    approverType: {
      type: String,
      enum: ["manager", "role", "employee"]
    },
    approverEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employees",
      default: null
    },
    approverRoleSlug: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ["queued", "pending", "approved", "rejected"],
      default: "queued"
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employees",
      default: null
    },
    actionByName: {
      type: String,
      default: null
    },
    actionAt: {
      type: Date,
      default: null
    },
    remarks: {
      type: String,
      default: null
    }
  },
  { _id: false }
);

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

    duration: {
      type: String,
      enum: ["full_day", "half_day"],
      default: "full_day"
    },

    halfDaySession: {
      type: String,
      enum: ["first_half", "second_half", null],
      default: null
    },

    totalDays: {
      type: Number,
      required: true
    },

    effectiveDateKeys: {
      type: [String],
      default: []
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
    actionByName: {
      type: String,
      default: null
    },

    actionAt: Date,

    rejectionReason: String,
    approvalFlowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "approval_flows",
      default: null
    },
    approvalSteps: {
      type: [approvalStepSchema],
      default: []
    },
    currentApprovalStep: {
      type: Number,
      default: null
    },

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
