const mongoose = require("mongoose");

const designationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "organizations",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    level: Number,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    isDeleted: {
      type: Boolean,
      default: false
    },

    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
    }
  },
  { timestamps: true }
);

designationSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true }
);

designationSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

module.exports = mongoose.model("designations", designationSchema);
