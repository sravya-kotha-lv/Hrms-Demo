const Organization = require("./organization.model");
const { seedRoles } = require("../roles/role.seed");
const { seedPermissions } = require("../permissions/permission.seed");
const { mapPermissionsToRoles } = require("../roles/role.permission.map");

/**
 * Create organization + seed RBAC
 */
exports.create = async (data) => {
  const exists = await Organization.findOne({ code: data.code });
  if (exists) {
    throw { code: 409, message: "Organization code already exists" };
  }

  const org = await Organization.create(data);

  // 🔥 Seed RBAC (VERY IMPORTANT)
  await seedRoles(org._id);
  await seedPermissions(org._id);
  await mapPermissionsToRoles(org._id);

  return org;
};

/**
 * Update organization
 */
exports.update = async (id, data) => {
  const org = await Organization.findById(id);
  if (!org) throw { code: 404, message: "Organization not found" };

  Object.assign(org, data);
  await org.save();

  return org;
};

/**
 * Get organization by ID
 */
exports.getById = async (id) => {
  const org = await Organization.findById(id);
  if (!org) throw { code: 404, message: "Organization not found" };
  return org;
};

/**
 * List organizations (Super Admin only)
 */
exports.list = async () => {
  return Organization.find().sort({ createdAt: -1 });
};
