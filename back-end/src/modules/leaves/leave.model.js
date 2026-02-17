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
