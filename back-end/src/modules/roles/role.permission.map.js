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
    "ROLE_VIEW",
    "ATTENDANCE_VIEW_ALL",
    "ATTENDANCE_VIEW_SELF",
    "ATTENDANCE_MANAGE",
    "NOTIFICATION_VIEW_SELF",
    "NOTIFICATION_MANAGE_SELF",
    "SHIFT_VIEW",
    "SHIFT_MANAGE",
    "SHIFT_VIEW_SELF",
    "EXPENSE_VIEW",
    "EXPENSE_MANAGE",
    "EXPENSE_ACTION"
  ],

  hr: [
    "EMP_CREATE",
    "EMP_UPDATE",
    "EMP_VIEW",
    "DEPT_VIEW"
  ],

  manager: [
    "EMP_VIEW",
    "EMP_SELF_VIEW",
    "ATTENDANCE_VIEW_ALL",
    "NOTIFICATION_VIEW_SELF",
    "NOTIFICATION_MANAGE_SELF",
    "SHIFT_VIEW_SELF",
    "EXPENSE_VIEW",
    "EXPENSE_ACTION"
  ],

  employee: [
    "EMP_SELF_VIEW",
    "ATTENDANCE_VIEW_SELF",
    "NOTIFICATION_VIEW_SELF",
    "NOTIFICATION_MANAGE_SELF",
    "SHIFT_VIEW_SELF"
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
