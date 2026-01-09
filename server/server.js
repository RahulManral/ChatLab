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

// --- CORS Configuration ---
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://chatlab-lac.vercel.app",
  "https://chatlab-web.vercel.app", // Added your frontend URL explicitly
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman or mobile apps)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("CORS Blocked Origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Explicitly handle Preflight (OPTIONS) requests
app.options("*", cors());

// --- Socket.IO Configuration ---
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Connect to MongoDB
connectDB();

// --- Database Cleanup Logic ---
const cleanupDatabase = async () => {
  try {
    console.log("Starting database cleanup...");
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await User.deleteMany({});
    console.log("✅ Database cleanup completed");
  } catch (error) {
    console.error("❌ Cleanup error:", error.message);
  }
};

const CLEANUP_INTERVAL = 60 * 60 * 1000;
setInterval(async () => {
  await cleanupDatabase();
}, CLEANUP_INTERVAL);

if (process.env.CLEANUP_ON_START === "true") {
  setTimeout(() => cleanupDatabase(), 5000);
}

// --- Middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Rate Limiting ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use("/api/auth", limiter);

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "ChatLab API is running",
    status: "healthy",
    allowedOrigins
  });
});

// --- Socket.IO Connection ---
const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("user-online", async (userId) => {
    userSocketMap.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
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
      });
      await message.save();
      
      const populatedMessage = await Message.findById(message._id).populate("sender", "username profilePhoto");
      io.to(data.conversationId).emit("new-message", populatedMessage);
    } catch (error) {
      console.error("Socket Message Error:", error);
    }
  });

  socket.on("disconnect", async () => {
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        io.emit("user-status-change", { userId, isOnline: false });
        break;
      }
    }
  });
});

// --- Error Handling ---
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: { message: err.message || "Internal Server Error" },
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;