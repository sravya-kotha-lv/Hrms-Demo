const { createJwtToken } = require("../../utils/jwtToken");
const Role = require("./role.model");
const UserModel = require("../users/user.model");
const { buildSuccessResponse } = require("../../utils/responseBuilder");
const { rotateUserToken } = require("../../utils/tokenManager");

exports.switchRole = async (req, res) => {
  const { roleId } = req.body;
  const user = req.user;

  console.log(user.activeRoleId?.toString(), roleId);
  
  // 🛑 Same role check
  if (user.activeRoleId?.toString() === roleId) {
    return res.json(
      buildSuccessResponse({
        message: "Role already active",
        data: { activeRoleId: roleId }
      })
    );
  }

  // 🔍 Ensure role belongs to user
  if (!user.roleIds.map(String).includes(roleId)) {
    throw { code: 403, message: "Role not assigned to user" };
  }

  // 🔍 Ensure role exists in same org
  const role = await Role.findOne({
    _id: roleId,
    organizationId: user.organizationId
  });

  if (!role) {
    throw { code: 404, message: "Role not found" };
  }

  // 🔐 Issue NEW token
  const token = createJwtToken({
    _id: user._id,
    email: user.email,
    organizationId: user.organizationId,
    roleIds: user.roleIds,
    activeRoleId: role._id
  });

  await rotateUserToken(UserModel, user._id, token);
  // ✅ Send token in header
  res.setHeader("Authorization", `Bearer ${token}`);

  return res.json(
    buildSuccessResponse({
      message: "Role switched successfully",
      data: {
        activeRole: {
          _id: role._id,
          name: role.name,
          slug: role.slug
        }
      }
    })
  );
};

