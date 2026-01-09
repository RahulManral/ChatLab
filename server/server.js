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

// CORS Configuration - SIMPLIFIED FOR VERCEL
const allowedOrigins = [
  "https://chatlab-web.vercel.app",
  "https://chatlab-lac.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

console.log("Allowed origins:", allowedOrigins);

// Trust proxy for Vercel
app.set("trust proxy", 1);

// Basic middleware first
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Simple CORS - let vercel.json handle headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,PATCH,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-Requested-With,Accept,Origin"
  );

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  next();
});

// Helmet - minimal config for Vercel
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: false,
  })
);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
  allowEIO3: true,
});

// Connect to MongoDB
connectDB();

// Database Cleanup Function
const cleanupDatabase = async () => {
  try {
    console.log("🧹 Starting database cleanup...");

    const messagesDeleted = await Message.deleteMany({});
    console.log(`📧 Deleted ${messagesDeleted.deletedCount} messages`);

    const conversationsDeleted = await Conversation.deleteMany({});
    console.log(
      `💬 Deleted ${conversationsDeleted.deletedCount} conversations`
    );

    const usersDeleted = await User.deleteMany({});
    console.log(`👥 Deleted ${usersDeleted.deletedCount} users`);

    console.log("✅ Database cleanup completed successfully");
  } catch (error) {
    console.error("❌ Database cleanup error:", error.message);
  }
};

// Auto-cleanup - disabled on Vercel
if (!process.env.VERCEL && process.env.NODE_ENV === "production") {
  const CLEANUP_INTERVAL = 60 * 60 * 1000;
  setInterval(async () => {
    console.log("⏰ Running scheduled database cleanup...");
    await cleanupDatabase();
  }, CLEANUP_INTERVAL);
}

// Optional: Run cleanup on server start
if (process.env.CLEANUP_ON_START === "true") {
  setTimeout(() => {
    cleanupDatabase();
  }, 5000);
}

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV !== "production";
  },
});

app.use("/api/auth", limiter);

// Health Check Endpoints
app.get("/", (req, res) => {
  res.json({
    message: "ChatLab API is running",
    status: "healthy",
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins,
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: "connected",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

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

      const populatedMessage = await Message.findById(
        message._id
      ).populate("sender", "username profilePhoto");

      io.to(data.conversationId).emit("new-message", populatedMessage);

      const conversation = await Conversation.findById(
        data.conversationId
      );
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

      console.log(
        `📨 Message sent in conversation ${data.conversationId}`
      );
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({
      error: {
        message: "CORS policy violation",
        details: err.message,
      },
    });
  }

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
      path: req.path,
    },
  });
});

// Start server - skip in Vercel
const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(
      `🌍 Environment: ${process.env.NODE_ENV || "development"}`
    );
  });
}

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