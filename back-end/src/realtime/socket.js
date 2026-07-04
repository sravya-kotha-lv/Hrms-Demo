const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../modules/users/user.model");

let ioInstance = null;

const normalizeToken = (token) => {
  if (!token || typeof token !== "string") return null;
  return token.startsWith("Bearer ") ? token.slice(7) : token;
};

const buildUserRoom = (organizationId, userId) => `attendance:${organizationId}:${userId}`;

const resolveAuthenticatedUser = async (token) => {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    throw new Error("Authorization token missing");
  }

  const decoded = jwt.verify(normalizedToken, process.env.JWT_SECRET);
  const userId = decoded.userId || decoded._id;
  const user = await User.findById(userId).select(
    "_id email organizationIds activeOrganizationId status tokenList passwordChangeRequired"
  );

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status !== "active") {
    throw new Error("User account is not active");
  }

  const hasMatchingActiveToken = Array.isArray(user.tokenList) && user.tokenList.some((entry) => {
    if (!entry?.token || entry.token !== normalizedToken) return false;
    if (entry.status && entry.status !== "active") return false;
    if (decoded.organizationId && entry.organizationId) {
      return String(entry.organizationId) === String(decoded.organizationId);
    }
    return true;
  });

  if (!hasMatchingActiveToken) {
    throw new Error("Session expired. Please login again.");
  }

  return {
    userId: String(user._id),
    organizationId: String(decoded.organizationId || ""),
    email: user.email
  };
};

const initRealtime = (httpServer, { allowedOrigins = [] } = {}) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
          return callback(new Error(`CORS policy does not allow this origin: ${origin}`), false);
        }
        return callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      const identity = await resolveAuthenticatedUser(token);
      socket.data.identity = identity;
      return next();
    } catch (error) {
      return next(new Error(error?.message || "Unauthorized"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const identity = socket.data.identity;
    if (identity?.organizationId && identity?.userId) {
      socket.join(buildUserRoom(identity.organizationId, identity.userId));
    }
  });

  return ioInstance;
};

const emitAttendanceUpdate = ({ organizationId, userId }, payload) => {
  if (!ioInstance || !organizationId || !userId) return;
  ioInstance.to(buildUserRoom(String(organizationId), String(userId))).emit("attendance:updated", payload);
};

module.exports = {
  initRealtime,
  emitAttendanceUpdate
};
