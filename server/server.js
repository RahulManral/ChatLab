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

// CORS Configuration - FIXED FOR VERCEL
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://chatlab-web.vercel.app",
  "https://chatlab-lac.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

console.log("Allowed origins:", allowedOrigins);

// Middleware - Apply in correct order
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Middleware - Must come AFTER body parsers
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, mobile apps, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blocked origin:", origin);
        callback(
          new Error(`CORS policy does not allow origin: ${origin}`),
          false
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600, // Cache preflight for 10 minutes
  })
);

// Explicit OPTIONS handler for all routes
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-Requested-With,Accept,Origin"
    );
    res.header("Access-Control-Max-Age", "600");
    return res.sendStatus(204);
  }
  res.sendStatus(403);
});

// Socket.IO with CORS
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

// Auto-cleanup every 1 hour (3600000 ms)
const CLEANUP_INTERVAL = 60 * 60 * 1000;

// Only run cleanup in production and not on serverless
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
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
});
app.use("/api/auth", limiter);

// Health Check Endpoints (before other routes)
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

  // Handle CORS errors specifically
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

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
      path: req.path,
    },
  });
});

// Start server
const PORT = process.env.PORT || 5000;

// Only start HTTP server if not in Vercel environment
if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(
      `🌍 Environment: ${process.env.NODE_ENV || "development"}`
    );
    console.log(`⏰ Database cleanup scheduled every 1 hour`);
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

// Export for Vercel serverless
export default app;