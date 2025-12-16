import express from "express";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import { authenticate } from "../middleware/auth.js";
import multer from "multer";
import path from "path";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "./uploads/profiles/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.get("/search", authenticate, async (req, res) => {
  try {
    const { query } = req.query;

    const users = await User.find({
      username: { $regex: query, $options: "i" },
      _id: { $ne: req.user._id },
    })
      .select("username profilePhoto isOnline lastSeen")
      .limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/add-contact", authenticate, async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.user.contacts.includes(userId)) {
      return res.status(400).json({ message: "User already in contacts" });
    }

    req.user.contacts.push(userId);
    await req.user.save();

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId], $size: 2 },
      isGroup: false,
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, userId],
      });
      await conversation.save();
    }

    res.json({
      message: "Contact added successfully",
      conversation: await conversation.populate("participants", "username profilePhoto isOnline"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/contacts", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "contacts",
      "username profilePhoto isOnline lastSeen"
    );

    res.json(user.contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/profile", authenticate, upload.single("profilePhoto"), async (req, res) => {
  try {
    const { username } = req.body;

    if (username && username !== req.user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
      req.user.username = username;
    }

    if (req.file) {
      req.user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
    }

    await req.user.save();

    res.json({
      id: req.user._id,
      username: req.user.username,
      profilePhoto: req.user.profilePhoto,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    req.user.password = newPassword;
    await req.user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;