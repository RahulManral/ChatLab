import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import messageRoutes from "./routes/messages.js";
import User from "./models/User.js";
import Message from "./models/Message.js";
import Conversation from "./models/Conversation.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

connectDB();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use("/api/auth", limiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("user-online", async (userId) => {
    userSocketMap.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
    });
    io.emit("user-status-change", { userId, isOnline: true });
  });

  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.on("send-message", async (data) => {
    try {
      const message = new Message({
        conversation: data.conversationId,
        sender: data.senderId,
        content: data.content,
        messageType: data.messageType || "text",
        fileUrl: data.fileUrl || "",
        fileName: data.fileName || "",
      });

      await message.save();

      await Conversation.findByIdAndUpdate(data.conversationId, {
        lastMessage: message._id,
        updatedAt: new Date(),
      });

      const populatedMessage = await Message.findById(message._id).populate(
        "sender",
        "username profilePhoto"
      );

      io.to(data.conversationId).emit("new-message", populatedMessage);

      const conversation = await Conversation.findById(data.conversationId);
      conversation.participants.forEach((participantId) => {
        if (participantId.toString() !== data.senderId) {
          const socketId = userSocketMap.get(participantId.toString());
          if (socketId) {
            io.to(socketId).emit("notification", {
              type: "new-message",
              message: populatedMessage,
              conversationId: data.conversationId,
            });
          }
        }
      });
    } catch (error) {
      console.error("Message error:", error);
      socket.emit("message-error", { message: error.message });
    }
  });

  socket.on("typing", (data) => {
    socket.to(data.conversationId).emit("user-typing", {
      userId: data.userId,
      username: data.username,
    });
  });

  socket.on("stop-typing", (data) => {
    socket.to(data.conversationId).emit("user-stop-typing", {
      userId: data.userId,
    });
  });

  socket.on("disconnect", async () => {
    console.log("❌ User disconnected:", socket.id);

    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
        io.emit("user-status-change", { userId, isOnline: false });
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});