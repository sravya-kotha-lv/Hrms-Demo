const Role = require("./role.model");
const Permission = require("../permissions/permission.model");

const ROLE_PERMISSION_MAP = {
  super_admin: ["*"],

  admin: [
    "USER_CREATE",
    "USER_VIEW",
    "EMP_CREATE",
    "EMP_UPDATE",
    "EMP_DELETE",
    "EMP_VIEW",
    "DEPT_CREATE",
    "DEPT_UPDATE",
    "DEPT_DELETE",
    "DEPT_VIEW",
    "ROLE_CREATE",
    "ROLE_UPDATE",
    "ROLE_VIEW"
  ],

  hr: [
    "EMP_CREATE",
    "EMP_UPDATE",
    "EMP_VIEW",
    "DEPT_VIEW"
  ],

  manager: [
    "EMP_VIEW",
    "EMP_SELF_VIEW"
  ],

  employee: [
    "EMP_SELF_VIEW"
  ]
};

exports.mapPermissionsToRoles = async (organizationId) => {
  const roles = await Role.find({ organizationId });
  const permissions = await Permission.find({ organizationId });

  for (const role of roles) {
    const allowedCodes = ROLE_PERMISSION_MAP[role.slug];
    if (!allowedCodes) continue;

    const permIds =
      allowedCodes[0] === "*"
        ? permissions.map(p => p._id)
        : permissions
            .filter(p => allowedCodes.includes(p.code))
            .map(p => p._id);

    role.permissionIds = permIds;
    await role.save();
  }
};
