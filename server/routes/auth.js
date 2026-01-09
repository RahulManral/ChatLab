import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// CORS headers middleware for auth routes
router.use((req, res, next) => {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    "https://chatlab-web.vercel.app",
    "https://chatlab-lac.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ].filter(Boolean);

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin) || !origin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-Requested-With,Accept,Origin"
    );
    res.header("Access-Control-Max-Age", "600");
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Validation middleware
const validateRegister = (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required",
      errors: {
        username: !username ? "Username is required" : null,
        password: !password ? "Password is required" : null,
      },
    });
  }

  if (username.length < 3) {
    return res.status(400).json({
      message: "Username must be at least 3 characters long",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters long",
    });
  }

  // Sanitize username (alphanumeric, underscore, hyphen only)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({
      message:
        "Username can only contain letters, numbers, underscores, and hyphens",
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required",
      errors: {
        username: !username ? "Username is required" : null,
        password: !password ? "Password is required" : null,
      },
    });
  }

  next();
};

// Register endpoint
router.post("/register", validateRegister, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      username: username.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists",
        field: "username",
      });
    }

    // Create new user
    const user = new User({
      username: username.toLowerCase(),
      password,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "fallback_secret_key",
      { expiresIn: "7d" }
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        profilePhoto: user.profilePhoto,
        isOnline: user.isOnline,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle duplicate key error (MongoDB)
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Username already exists",
        field: "username",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {}),
      });
    }

    res.status(500).json({
      message: "Registration failed. Please try again later.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Login endpoint
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user (case-insensitive)
    const user = await User.findOne({
      username: username.toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
        field: "credentials",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid username or password",
        field: "credentials",
      });
    }

    // Update user status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "fallback_secret_key",
      { expiresIn: "7d" }
    );

    // Return success response
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        profilePhoto: user.profilePhoto,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed. Please try again later.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get current user endpoint
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        profilePhoto: user.profilePhoto,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      message: "Failed to fetch user data",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Logout endpoint (optional - mainly for updating user status)
router.post("/logout", authenticate, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
    });

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      message: "Logout failed",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Verify token endpoint
router.get("/verify", authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      valid: true,
      userId: req.user._id,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      valid: false,
      message: "Invalid token",
    });
  }
});

// Health check for auth routes
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "auth",
    timestamp: new Date().toISOString(),
  });
});

export default router;