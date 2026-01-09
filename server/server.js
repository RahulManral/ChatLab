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
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// 1. Define allowed origins clearly
const allowedOrigins = [
  "https://chatlab-web.vercel.app",
  "https://chatlab-lac.vercel.app",
  "http://localhost:5173",
].filter(Boolean);

// 2. MANUAL CORS MIDDLEWARE (Fixes the "HTTP ok status" preflight error)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");
  
  // IMMEDIATELY respond to preflight with 200 OK
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// 3. Regular CORS (as a backup/for Socket.io compatibility)
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Connect to MongoDB
connectDB();

// 4. Other Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// Health Check
app.get("/", (req, res) => res.status(200).json({ status: "ok" }));

// 6. Socket.IO
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true }
});

// ... (Your Socket.io logic remains the same)

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));

export default app;