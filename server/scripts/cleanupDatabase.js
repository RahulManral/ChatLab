import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

dotenv.config();

const cleanupDatabase = async () => {
  try {
    console.log("🧹 Starting database cleanup...");

    // Delete all messages
    const messagesDeleted = await Message.deleteMany({});
    console.log(`📧 Deleted ${messagesDeleted.deletedCount} messages`);

    // Delete all conversations
    const conversationsDeleted = await Conversation.deleteMany({});
    console.log(
      `💬 Deleted ${conversationsDeleted.deletedCount} conversations`
    );

    // Delete all users (keep this optional based on your needs)
    const usersDeleted = await User.deleteMany({});
    console.log(`👥 Deleted ${usersDeleted.deletedCount} users`);

    console.log("✅ Database cleanup completed successfully");
  } catch (error) {
    console.error("❌ Database cleanup error:", error.message);
  }
};

export default cleanupDatabase;