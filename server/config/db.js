import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Check if MONGO_URI exists
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in environment variables");
      console.log("Available env vars:", Object.keys(process.env));
      process.exit(1);
    }

    console.log("🔄 Attempting to connect to MongoDB...");
    console.log(
      "MongoDB URI (first 20 chars):",
      process.env.MONGO_URI.substring(0, 20) + "..."
    );

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

export default connectDB;