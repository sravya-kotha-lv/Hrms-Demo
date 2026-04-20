const mongoose = require("mongoose");
const Role = require("./role.model");
const organizationService = require("../organizations/organization.service");
const permissionService = require("../permissions/permission.service");

const getDefaultPermissionIds = async (organizationId) => {
  const employeeRole = await Role.findOne({
    organizationId,
    slug: "employee"
  }).select("permissionIds");

  return employeeRole?.permissionIds || [];
};
/**
 * Get roles by roleIds (used by auth/login)
 */
exports.getRolesByIds = async (roleIds = []) => {
  if (!Array.isArray(roleIds) || roleIds.length === 0) return [];

  return Role.find({
    _id: { $in: roleIds.map(id => new mongoose.Types.ObjectId(id)) }
  }).lean();
};

/**
 * Create role
 */
exports.create = async ({ organizationId, name, slug, permissionIds = [], isSystemRole = false }) => {

  await organizationService.getOrganizationById(organizationId);

  const existing = await Role.findOne({ organizationId, slug }).lean();
  if (existing) {
    throw {
      code: 409,
      message: "Role with same slug already exists in this organization"
    };
  }

  const resolvedPermissionIds = permissionIds.length
    ? permissionIds
    : await getDefaultPermissionIds(organizationId);

  await permissionService.getByIds(resolvedPermissionIds, organizationId);

  return Role.create({
    organizationId,
    name,
    slug,
    permissionIds: resolvedPermissionIds,
    isSystemRole
  });
};

/**
 * Update role
 */
exports.update = async (id, data) => {
  const role = await Role.findById(id);
  if (!role) throw { code: 404, message: "Role not found" };

  Object.assign(role, data);
  return role.save();
};

/**
 * Delete role
 */
exports.remove = async (id) => {
  const role = await Role.findById(id);
  if (!role) throw { code: 404, message: "Role not found" };

  if (role.isSystemRole) {
    throw { code: 403, message: "System roles cannot be deleted" };
  }

  await role.deleteOne();
};

/**
 * List roles
 */
exports.list = async (organizationId) => {
  console.log(organizationId,"orgid");
  
  return Role.find({ organizationId }).lean();
};

/**
 * Get role by id
 */
exports.getById = async (id) => {
  const role = await Role.findById(id).lean();
  if (!role) throw { code: 404, message: "Role not found" };
  return role;
};
