const Joi = require("joi");
const mongoose = require("mongoose");

/* -------------------------------------------------------------------------- */
/*                               COMMON HELPERS                                */
/* -------------------------------------------------------------------------- */

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
}, "ObjectId validation");

/* -------------------------------------------------------------------------- */
/*                               CREATE ROLE                                   */
/* -------------------------------------------------------------------------- */

exports.createRoleSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  slug: Joi.string()
    .trim()
    .lowercase()
    .regex(/^[a-z_]+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Slug can contain only lowercase letters and underscores"
    }),

  permissionIds: Joi.array()
    .items(objectId)
    .min(1)
    .required(),

  isSystemRole: Joi.boolean().optional()
});

/* -------------------------------------------------------------------------- */
/*                               UPDATE ROLE                                   */
/* -------------------------------------------------------------------------- */

exports.updateRoleSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .optional(),

  permissionIds: Joi.array()
    .items(objectId)
    .min(1)
    .optional()
});

/* -------------------------------------------------------------------------- */
/*                               ROLE SWITCH                                   */
/* -------------------------------------------------------------------------- */

exports.switchRoleSchema = Joi.object({
  roleId: objectId.required()
});
