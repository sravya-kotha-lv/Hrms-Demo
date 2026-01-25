const Role = require("../modules/roles/role.model");
const Permission = require("../modules/permissions/permission.model");

/**
 * RBAC authorize middleware
 * Usage: authorize("EMP_CREATE")
 */
module.exports = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      console.log(user,req.user, "userid");

      // 🔐 Basic guard
      if (!user || !user.activeRoleId) {
        return res.status(403).json({
          success: false,
          code: 403,
          message: "Access denied: active role not set",
          data: null,
          error: null
        });
      }

      // 🔍 Fetch role (let mongoose cast ObjectId)
      const role = await Role.findOne({
        _id: user.activeRoleId,
        organizationId: user.organizationId
      }).lean();

      if (!role) {
        return res.status(403).json({
          success: false,
          code: 403,
          message: "Role not found",
          data: null,
          error: null
        });
      }

      // ⭐ SYSTEM ROLE → FULL ACCESS
      if (role.isSystemRole === true) {
        return next();
      }
      console.log("Allowed to next");

      // 🚫 No permissions assigned
      if (!role.permissionIds || role.permissionIds.length === 0) {
        return res.status(403).json({
          success: false,
          code: 403,
          message: "No permissions assigned to role",
          data: null,
          error: null
        });
      }
      console.log("Allowed to next");

      // 🔍 Fetch permissions
      const permissions = await Permission.find({
        _id: { $in: role.permissionIds },
        organizationId: user.organizationId
      })
        .select("code")
        .lean();

      const permissionCodes = permissions.map(p => p.code);

      // ⭐ Wildcard permission support
      if (permissionCodes.includes("*")) {
        return next();
      }

      // ❌ Permission denied
      if (!permissionCodes.includes(requiredPermission)) {
        return res.status(403).json({
          success: false,
          code: 403,
          message: `Permission denied: ${requiredPermission}`,
          data: null,
          error: null
        });
      }

      // ✅ Permission allowed      
      next();
    } catch (err) {
      console.error("Authorize error:", err);

      return res.status(500).json({
        success: false,
        code: 500,
        message: "Authorization failed",
        data: null,
        error: err.message
      });
    }
  };
};
