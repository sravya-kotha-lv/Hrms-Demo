const jwt = require("jsonwebtoken");
const User = require("../modules/users/user.model");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "Authorization token missing",
        data: null,
        error: null
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded._id;
    
    const user = await User.findById(userId).select(
      "_id email organizationIds activeOrganizationId status tokenList"
    );

    console.log(user, decoded);

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "User not found",
        data: null,
        error: null
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        code: 403,
        message: "User account is not active",
        data: null,
        error: null
      });
    }

    if (!user.tokenList?.[0] || user.tokenList[0].token !== token) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "Session expired. Please login again.",
        data: null,
        error: null
      });
    }

    // org-scoped context
    req.user = {
      userId: user._id,
      email: user.email,
      organizationId: decoded.organizationId,
      roleIds: decoded.roleIds,
      activeRoleId: decoded.activeRoleId
    };

    req.token = token;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: "Invalid or expired token",
      data: null,
      error: err.message
    });
  }
};
