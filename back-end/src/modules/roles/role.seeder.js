const Role = require("./role.model");
const Permission = require("../permissions/permission.model");
const { extractPermissionsFromRoutes } = require("../../utils/permissionsFromRoutes");

const ROLE_DEFS = [
  { name: "OrgAdmin", slug: "org-admin" },
  { name: "HR", slug: "hr" },
  { name: "Manager", slug: "manager" },
  { name: "Employee", slug: "employee" }
];

const ROLE_RULES = {
  "org-admin": { type: "all" },
  admin: { type: "all" },
  hr: { type: "allExcept", exclude: ["ORG_MANAGE"] },
  manager: {
    type: "include",
    codes: [
      "EMP_VIEW",
      "LEAVE_VIEW_ALL",
      "LEAVE_VIEW_SELF",
      "LEAVE_ACTION",
      "LEAVE_APPLY",
      "EMP_SELF_VIEW",
      "EMP_SELF_EDIT",
      "DEPT_VIEW",
      "DESIG_VIEW",
      "TIMESHEET_CHECKIN_SELF",
      "TIMESHEET_CHECKOUT_SELF",
      "TIMESHEET_VIEW_SELF",
      "TIMESHEET_CREATE_SELF",
      "TIMESHEET_EDIT_SELF",
      "TIMESHEET_SUBMIT_SELF",
      "TIMESHEET_RECALL_SELF",
      "WEEK_OFF_VIEW",
      "TIMESHEET_VIEW_ALL",
      "TIMESHEET_ACTION",
    ]
  },
  employee: {
    type: "predicate",
    match: (code) =>
      code.includes("_SELF") ||
      code === "LEAVE_APPLY" ||
      code === "WEEK_OFF_VIEW" ||
      code === "DEPT_VIEW" ||
      code === "DESIG_VIEW" ||
      code === "TIMESHEET_VIEW_ALL" ||
      code === "TIMESHEET_RECALL_SELF" ||
      code === "ORG_SETTINGS_VIEW"
  }
};

const ensureRoles = async (organizationId) => {
  for (const role of ROLE_DEFS) {
    const exists = await Role.findOne({
      organizationId,
      slug: role.slug
    });

    if (!exists) {
      await Role.create({
        organizationId,
        name: role.name,
        slug: role.slug,
        permissionIds: [],
        isSystemRole: false
      });
    }
  }
};

const ensurePermissions = async (organizationId) => {
  let allAccess = await Permission.findOne({
    organizationId,
    code: "*"
  });

  if (!allAccess) {
    allAccess = await Permission.create({
      organizationId,
      name: "ALL_ACCESS",
      code: "*",
      module: "ORG"
    });
  }

  const routePermissions = extractPermissionsFromRoutes();

  for (const perm of routePermissions) {
    const exists = await Permission.findOne({
      organizationId,
      code: perm.code
    });

    if (!exists) {
      await Permission.create({
        organizationId,
        name: perm.name,
        code: perm.code,
        module: perm.module
      });
    }
  }
};

const resolvePermissionIds = (permissions, rule) => {
  if (!rule) return [];

  if (rule.type === "all") {
    return permissions.map((p) => p._id);
  }

  if (rule.type === "allExcept") {
    const excludeSet = new Set(rule.exclude || []);
    return permissions
      .filter((p) => !excludeSet.has(p.code))
      .map((p) => p._id);
  }

  if (rule.type === "include") {
    const includeSet = new Set(rule.codes || []);
    return permissions
      .filter((p) => includeSet.has(p.code))
      .map((p) => p._id);
  }

  if (rule.type === "predicate" && typeof rule.match === "function") {
    return permissions
      .filter((p) => rule.match(p.code))
      .map((p) => p._id);
  }

  return [];
};

const mapPermissionsToRoles = async (organizationId) => {
  const roles = await Role.find({ organizationId });
  const permissions = await Permission.find({ organizationId });

  for (const role of roles) {
    const rule = ROLE_RULES[role.slug];
    if (!rule) continue;

    role.permissionIds = resolvePermissionIds(permissions, rule);
    await role.save();
  }
};

exports.seedOrgRolesAndPermissions = async (organizationId) => {
  await ensurePermissions(organizationId);
  await ensureRoles(organizationId);
  await mapPermissionsToRoles(organizationId);
};
