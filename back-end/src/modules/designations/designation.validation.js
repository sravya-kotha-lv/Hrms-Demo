const Joi = require("joi");
const { buildNameSchema } = require("../../utils/joiValidators");

exports.createDesignationSchema = Joi.object({
  name: buildNameSchema({ required: true }),
  level: Joi.number().optional(),
  departmentId: Joi.string().required(),
  status: Joi.string().valid("active", "inactive").default("active")
});

exports.updateDesignationSchema = Joi.object({
  name: buildNameSchema(),
  level: Joi.number().optional(),
  departmentId: Joi.string().required(),
  status: Joi.string().valid("active", "inactive").optional()
});
