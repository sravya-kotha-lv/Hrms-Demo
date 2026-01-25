const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI not defined in environment variables");
    }

    mongoose.set("strictQuery", true);

    await mongoose.connect(mongoUri);

    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed");
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
