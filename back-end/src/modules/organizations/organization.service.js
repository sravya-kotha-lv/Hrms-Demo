const Organization = require("./organization.model");
const User = require("../users/user.model");
const OrgUser = require("./org-user.model");
const Role = require("../roles/role.model");
const { seedOrgRolesAndPermissions } = require("../roles/role.seeder");

/**
 * CREATE ORGANIZATION + ASSIGN ADMIN
 */
exports.createOrganization = async ({
  name,
  code,
  timezone,
  currency,
  adminUserId,
  adminRoleId
}) => {
  const org = await Organization.create({
    name,
    code,
    timezone,
    currency
  });

  await seedOrgRolesAndPermissions(org._id);

  let adminRole = null;
  if (adminRoleId) {
    adminRole = await Role.findOne({
      _id: adminRoleId,
      organizationId: org._id
    });
  }

  if (!adminRole) {
    adminRole = await Role.findOne({
      slug: "org-admin",
      organizationId: org._id
    });
  }

  if (!adminRole) {
    throw { code: 400, message: "Admin role not found for organization" };
  }

  const admin = await User.findById(adminUserId);
  if (!admin) {
    throw { code: 404, message: "Admin user not found" };
  }

  if (!admin.organizationIds.includes(org._id)) {
    admin.organizationIds.push(org._id);
    admin.activeOrganizationId = org._id;
    await admin.save();
  }

  await OrgUser.create({
    userId: admin._id,
    organizationId: org._id,
    roleIds: [adminRole._id]
  });

  return org;
};

/**
 * Get organizations visible to logged-in user
 */
exports.getOrganizations = async ({ user }) => {
  const isSuperAdmin = await isUserSuperAdmin(user.userId);
  if (isSuperAdmin) {
    return Organization.find({ code: { $ne: "SYSTEM" } })
      .sort({ createdAt: -1 });
  }

  const memberships = await OrgUser.find({
    userId: user.userId
  }).select("organizationId");

  const orgIds = memberships.map(m => m.organizationId);

  return Organization.find({
    _id: { $in: orgIds },
    status: "active"
  }).sort({ createdAt: -1 });
};

/**
 * Helper: detect SuperAdmin safely
 */
async function isUserSuperAdmin(userId) {
  const memberships = await OrgUser.find({ userId }).populate("roleIds");

  return memberships.some(m =>
    m.roleIds.some(r => r.slug === "superadmin")
  );
}

/**
 * GET ORGANIZATION BY ID
 */
exports.getOrganizationById = async (orgId) => {
  const org = await Organization.findById(orgId);

  if (!org) {
    throw { code: 404, message: "Organization not found" };
  }

  return org;
};

/**
 * UPDATE ORGANIZATION
 */
exports.updateOrganization = async (orgId, payload) => {
  const org = await Organization.findByIdAndUpdate(
    orgId,
    payload,
    { new: true }
  );

  if (!org) {
    throw { code: 404, message: "Organization not found" };
  }

  return org;
};

/**
 * SOFT DELETE ORGANIZATION
 */
exports.deleteOrganization = async (orgId) => {
  const org = await Organization.findByIdAndUpdate(
    orgId,
    { status: "inactive" },
    { new: true }
  );

  if (!org) {
    throw { code: 404, message: "Organization not found" };
  }

  return true;
};
