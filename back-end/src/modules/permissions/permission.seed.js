const Permission = require("./permission.model");

const PERMISSIONS = [
  // 👤 Users
  { code: "USER_CREATE", name: "Create User", module: "Users" },
  { code: "USER_VIEW", name: "View Users", module: "Users" },

  // 👥 Employees
  { code: "EMP_CREATE", name: "Create Employee", module: "Employees" },
  { code: "EMP_UPDATE", name: "Update Employee", module: "Employees" },
  { code: "EMP_DELETE", name: "Delete Employee", module: "Employees" },
  { code: "EMP_VIEW", name: "View Employees", module: "Employees" },
  { code: "EMP_SELF_VIEW", name: "View Own Profile", module: "Employees" },

  // 🏢 Departments
  { code: "DEPT_CREATE", name: "Create Department", module: "Departments" },
  { code: "DEPT_UPDATE", name: "Update Department", module: "Departments" },
  { code: "DEPT_DELETE", name: "Delete Department", module: "Departments" },
  { code: "DEPT_VIEW", name: "View Departments", module: "Departments" },
  { code: "DEPT_RESTORE", name: "Restore Department", module: "Departments" },

  // 🔐 Roles
  { code: "ROLE_CREATE", name: "Create Role", module: "Roles" },
  { code: "ROLE_UPDATE", name: "Update Role", module: "Roles" },
  { code: "ROLE_DELETE", name: "Delete Role", module: "Roles" },
  { code: "ROLE_VIEW", name: "View Roles", module: "Roles" },

  // 🏢 Organizations
  { code: "ORG_CREATE", name: "Create Organization", module: "Organizations" },
  { code: "ORG_UPDATE", name: "Update Organization", module: "Organizations" },
  { code: "ORG_VIEW", name: "View Organizations", module: "Organizations" },

  // 📅 Attendance
  { code: "ATTENDANCE_VIEW_ALL", name: "View Attendance All", module: "Attendance" },
  { code: "ATTENDANCE_VIEW_SELF", name: "View Attendance Self", module: "Attendance" },
  { code: "ATTENDANCE_MANAGE", name: "Manage Attendance", module: "Attendance" },

];

exports.seedPermissions = async (organizationId) => {
  for (const perm of PERMISSIONS) {
    const exists = await Permission.findOne({
      organizationId,
      code: perm.code
    });

    if (!exists) {
      await Permission.create({
        organizationId,
        ...perm
      });
    }
  }
};
