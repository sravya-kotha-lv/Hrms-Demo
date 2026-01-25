const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
});

exports.createDepartmentSchema = Joi.object({
  name: Joi.string().min(2).required(),
  code: Joi.string().min(2).required(),
  managerId: objectId.optional().allow(null)
});

exports.updateDepartmentSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  code: Joi.string().min(2).optional(),
  managerId: objectId.optional().allow(null),
  status: Joi.string().valid("active", "inactive").optional()
});
