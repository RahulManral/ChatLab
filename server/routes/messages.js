import express from "express";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { authenticate } from "../middleware/auth.js";
import multer from "multer";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "./uploads/files/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.get("/conversations", authenticate, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "username profilePhoto isOnline lastSeen")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "username" },
      })
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/create-group", authenticate, async (req, res) => {
  try {
    const { groupName, participants } = req.body;

    const conversation = new Conversation({
      participants: [req.user._id, ...participants],
      isGroup: true,
      groupName,
      groupAdmin: req.user._id,
    });

    await conversation.save();

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePhoto isOnline")
      .populate("groupAdmin", "username");

    res.json(populatedConversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:conversationId", authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "username profilePhoto")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:conversationId/mark-read", authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        "readBy.user": { $ne: req.user._id },
      },
      {
        $push: {
          readBy: {
            user: req.user._id,
            readAt: new Date(),
          },
        },
      }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/upload", authenticate, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    res.json({
      fileUrl: `/uploads/files/${req.file.filename}`,
      fileName: req.file.originalname,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;