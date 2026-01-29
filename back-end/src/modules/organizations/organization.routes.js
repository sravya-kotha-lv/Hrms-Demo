const router = require("express").Router();
const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const validate = require("../../middlewares/validate.middleware");
const asyncHandler = require("../../middlewares/asyncHandler");

const controller = require("./organization.controller");
const {
  createOrganizationSchema,
  updateOrganizationSchema
} = require("./organization.validation");

/**
 * CREATE ORGANIZATION
 * SuperAdmin / OrgAdmin
 */
router.post(
  "/",
  auth,
  authorize("ORG_MANAGE"),
  validate(createOrganizationSchema),
  asyncHandler(controller.create)
);

/**
 * UPDATE ORGANIZATION
 */
router.put(
  "/:id",
  auth,
  authorize("ORG_MANAGE"),
  validate(updateOrganizationSchema),
  asyncHandler(controller.update)
);

/**
 * GET ORGANIZATION BY ID
 */
router.get(
  "/:id",
  auth,
  authorize("ORG_VIEW"),
  asyncHandler(controller.getById)
);

/**
 * LIST ORGANIZATIONS
 */
router.get(
  "/",
  auth,
  authorize("ORG_VIEW"),
  asyncHandler(controller.list)
);

/**
 * DELETE (SOFT) ORGANIZATION
 */
router.delete(
  "/:id",
  auth,
  authorize("ORG_MANAGE"),
  asyncHandler(controller.deleteById)
);

module.exports = router;
