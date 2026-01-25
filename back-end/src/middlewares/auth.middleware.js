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

    // 🔐 Verify JWT signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔍 Load user
    const user = await User.findById(decoded._id).select(
      "_id email roleIds organizationId status tokenList"
    );

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

    // 🔥 TOKEN MUST MATCH DB (ONLY tokenList[0] is valid)
    if (!user.tokenList?.[0] || user.tokenList[0].token !== token) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: "Session expired. Please login again.",
        data: null,
        error: null
      });
    }

    // ✅ Attach user context
    req.user = {
      _id: user._id,
      email: user.email,
      organizationId: user.organizationId,
      roleIds: decoded.roleIds || [],
      activeRoleId: decoded.activeRoleId
    };

    req.token = token;

    next();
  } catch (err) {
    console.error("Auth error:", err.message);

    return res.status(401).json({
      success: false,
      code: 401,
      message: "Invalid or expired token",
      data: null,
      error: err.message
    });
  }
};
