// src/utils/tokenManager.js
exports.rotateUserToken = async (UserModel, userId, newToken) => {
  const limit = Number(process.env.TOKEN_LIST_LIMIT || 10);

  // 🔹 Pull existing tokens
  const user = await UserModel.findById(userId).select("tokenList");
  let tokenList = user?.tokenList || [];

  // 🔹 Add new token at index 0
  tokenList.unshift({
    token: newToken,
    loginTimestamp: new Date(),
    status: "active"
  });

  // 🔹 Trim old tokens
  if (tokenList.length > limit) {
    tokenList = tokenList.slice(0, limit);
  }

  // 🔹 Save back
  await UserModel.findByIdAndUpdate(userId, {
    tokenList,
    lastLoginAt: new Date()
  });
};
