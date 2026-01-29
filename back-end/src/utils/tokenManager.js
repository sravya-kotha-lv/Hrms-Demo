exports.rotateUserToken = async (UserModel, userId, newToken) => {
  const limit = Number(process.env.TOKEN_LIST_LIMIT || 10);

  try {
    
    const result = await UserModel.updateOne(
      { _id: userId },
      {
        $push: {
          tokenList: {
            $each: [
              {
                token: newToken,
                loginTimestamp: new Date().toISOString(),
                status: "active"
              }
            ],
            $position: 0,
            $slice: limit
          }
        },
        $set: {
          lastLoginAt: new Date()
        }
      }
    );
    console.log(result);

    if (result.matchedCount === 0) {
      throw new Error("User not found while rotating token");
    }

    return true;
  } catch (err) {
    console.error("❌ rotateUserToken failed:", err);
    throw err;
  }
};
