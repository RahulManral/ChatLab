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

// CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://chatlab-web.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

console.log("Allowed origins:", allowedOrigins);

// Trust proxy for Render
app.set("trust proxy", 1);

// CORS Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Connect to MongoDB
connectDB();

// Schedule cleanup to run once every 24 hours
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

const cleanupDatabase = async () => {
  try {
    console.log("🧹 Starting scheduled 24-hour database wipe...");
    const messagesDeleted = await Message.deleteMany({});
    console.log(`📧 Deleted ${messagesDeleted.deletedCount} messages`);
    
    const conversationsDeleted = await Conversation.deleteMany({});
    console.log(`💬 Deleted ${conversationsDeleted.deletedCount} conversations`);
    
    const usersDeleted = await User.deleteMany({});
    console.log(`👥 Deleted ${usersDeleted.deletedCount} users`);
    
    console.log("✅ Database wiped successfully");
  } catch (error) {
    console.error("❌ Database cleanup error:", error.message);
  }
};

// Run cleanup every 24 hours
setInterval(async () => {
  console.log("⏰ Running scheduled 24-hour database wipe...");
  await cleanupDatabase();
}, CLEANUP_INTERVAL);

// Optional: Run cleanup on server start
if (process.env.WIPE_ON_START === "true") {
  setTimeout(() => {
    cleanupDatabase();
  }, 5000);
}

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/auth", limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// Health Check Endpoint
app.get("/", (req, res) => {
  res.json({
    message: "ChatLab API is running",
    status: "healthy",
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// User Socket Map
const userSocketMap = new Map();

// Socket.IO Connection
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("user-online", async (userId) => {
    try {
      userSocketMap.set(userId, socket.id);
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });
      io.emit("user-status-change", { userId, isOnline: true });
      console.log(`👤 User ${userId} is now online`);
    } catch (error) {
      console.error("Error setting user online:", error);
    }
  });

  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(
      `💬 Socket ${socket.id} joined conversation ${conversationId}`
    );
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

      console.log(`📨 Message sent in conversation ${data.conversationId}`);
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
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
          io.emit("user-status-change", { userId, isOnline: false });
          console.log(`👤 User ${userId} is now offline`);
        } catch (error) {
          console.error("Error setting user offline:", error);
        }
        break;
      }
    }
  });
});
// Self-Ping Mechanism to Prevent Render Sleep
const SELF_PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
let selfPingTimer = null;
let pingCount = 0;

const selfPing = async () => {
  try {
    const url =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.SELF_PING_URL ||
      "https://chatlab-server.onrender.com";

    const response = await fetch(`${url}/api/keep-alive`, {
      method: "GET",
      headers: {
        "User-Agent": "ChatLab-KeepAlive/1.0",
      },
    });

    if (response.ok) {
      pingCount++;
      const data = await response.json();
      console.log(
        `✅ Self-ping #${pingCount} successful at ${data.timestamp}`
      );
      console.log(`⏱️  Server uptime: ${Math.floor(process.uptime() / 60)} minutes`);
    } else {
      console.log(`⚠️  Self-ping failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Self-ping error:", error.message);
  }
};

// Start self-ping in production
if (process.env.NODE_ENV === "production" || process.env.ENABLE_SELF_PING === "true") {
  console.log("🔄 Self-ping mechanism enabled");
  console.log(`⏰ Will ping every ${SELF_PING_INTERVAL / 60000} minutes`);

  // Initial ping after 2 minutes (let server fully start)
  setTimeout(() => {
    selfPing();
  }, 2 * 60 * 1000);

  // Regular pings every 14 minutes
  selfPingTimer = setInterval(selfPing, SELF_PING_INTERVAL);
} else {
  console.log("ℹ️  Self-ping disabled (development mode)");
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
    },
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⏰ Database cleanup scheduled every 1 hour`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

export default app;