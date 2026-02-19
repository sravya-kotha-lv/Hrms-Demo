const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI not defined in environment variables");
    }

    mongoose.set("strictQuery", true);

    const maxPoolSize = Number(process.env.MONGO_MAX_POOL_SIZE || 100);
    const minPoolSize = Number(process.env.MONGO_MIN_POOL_SIZE || 10);
    const serverSelectionTimeoutMS = Number(
      process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000
    );
    const socketTimeoutMS = Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000);

    await mongoose.connect(mongoUri, {
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS,
      socketTimeoutMS,
      autoIndex: process.env.NODE_ENV !== "production"
    });

    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed");
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
