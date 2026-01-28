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

router.post(
  "/",
  auth,
  authorize("ORG_CREATE"),
  validate(createOrganizationSchema),
  asyncHandler(controller.create)
);

router.put(
  "/:id",
  auth,
  authorize("ORG_UPDATE"),
  validate(updateOrganizationSchema),
  asyncHandler(controller.update)
);

router.get(
  "/:id",
  auth,
  authorize("ORG_VIEW"),
  asyncHandler(controller.getById)
);

router.get(
  "/",
  auth,
  authorize("ORG_VIEW"),
  asyncHandler(controller.list)
);

router.delete(
  "/:id",
  auth,
  authorize("ORG_DELETE"),
  asyncHandler(controller.deleteById)
);

module.exports = router;
