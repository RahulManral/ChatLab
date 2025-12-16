import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Image as ImageIcon,
  Paperclip,
  Download,
  Check,
  MessageSquare,
  CheckCheck,
} from "lucide-react";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { format, isToday, isYesterday } from "date-fns";

export default function ChatBox({ conversation }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (conversation) {
      fetchMessages();
      markMessagesAsRead();

      if (socket) {
        socket.emit("join-conversation", conversation._id);

        socket.on("new-message", handleNewMessage);
        socket.on("user-typing", handleUserTyping);
        socket.on("user-stop-typing", handleStopTyping);

        return () => {
          socket.off("new-message", handleNewMessage);
          socket.off("user-typing", handleUserTyping);
          socket.off("user-stop-typing", handleStopTyping);
        };
      }
    }
  }, [conversation, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/messages/${conversation._id}`);
      setMessages(response.data);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await api.post(`/messages/${conversation._id}/mark-read`);
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  };

  const handleNewMessage = (message) => {
    if (message.conversation === conversation._id) {
      setMessages((prev) => [...prev, message]);
      markMessagesAsRead();
    }
  };

  const handleUserTyping = ({ username }) => {
    setTyping(true);
    setTypingUser(username);
  };

  const handleStopTyping = () => {
    setTyping(false);
    setTypingUser("");
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (socket && conversation) {
      socket.emit("typing", {
        conversationId: conversation._id,
        userId: user.id,
        username: user.username,
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stop-typing", {
          conversationId: conversation._id,
          userId: user.id,
        });
      }, 1000);
    }
  };

  const sendMessage = async (messageData) => {
    if (!socket || !conversation) return;

    socket.emit("send-message", {
      conversationId: conversation._id,
      senderId: user.id,
      ...messageData,
    });

    setInputText("");
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage({ content: inputText, messageType: "text" });
    }
  };

  const handleFileUpload = async (file, type) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/messages/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      sendMessage({
        content: "",
        messageType: type,
        fileUrl: response.data.fileUrl,
        fileName: response.data.fileName,
      });
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file, "image");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file, "file");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "HH:mm");
    } else if (isYesterday(messageDate)) {
      return `Yesterday ${format(messageDate, "HH:mm")}`;
    } else {
      return format(messageDate, "dd/MM/yyyy HH:mm");
    }
  };

  const isMessageRead = (message) => {
    return message.readBy?.some((read) => read.user !== user.id);
  };

  if (!conversation) {
    return (
      <div className="flex flex-col flex-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl shadow-md p-4">
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <MessageSquare size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Select a conversation to start chatting</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl shadow-md overflow-hidden">
      {/* Chat area with thin scrollbar */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 space-y-4 thin-scrollbar">
        {messages.map((message) => {
          const isOwn = message.sender._id === user.id;
          const isRead = isMessageRead(message);

          return (
            <div
              key={message._id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] ${
                  isOwn
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                } p-3 rounded-xl shadow-sm border border-gray-300 dark:border-gray-600`}
              >
                {!isOwn && conversation.isGroup && (
                  <p className="text-xs font-semibold mb-1 opacity-75">
                    {message.sender.username}
                  </p>
                )}

                {message.messageType === "text" && (
                  <p className="break-words">{message.content}</p>
                )}

                {message.messageType === "image" && (
                  <div>
                    <img
                      src={message.fileUrl}
                      alt="Shared image"
                      className="rounded-lg max-w-full h-auto mb-2"
                    />
                    {message.content && (
                      <p className="break-words">{message.content}</p>
                    )}
                  </div>
                )}

                {message.messageType === "file" && (
                  <div className="flex items-center gap-2">
                    <Paperclip size={16} />
                    <div className="flex-1">
                      <p className="text-sm font-medium truncate">
                        {message.fileName}
                      </p>
                    </div>
                    <a
                      href={message.fileUrl}
                      download
                      className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs opacity-75">
                    {formatMessageTime(message.createdAt)}
                  </span>
                  {isOwn && (
                    <>
                      {isRead ? (
                        <CheckCheck size={14} className="text-blue-300" />
                      ) : (
                        <Check size={14} className="opacity-75" />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex">
            <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 rounded-xl max-w-[60%] shadow-sm border border-gray-300 dark:border-gray-600">
              <p className="text-sm italic">{typingUser} is typing...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSendText}
        className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-600 p-4"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          type="file"
          ref={imageInputRef}
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition disabled:opacity-50"
        >
          <Paperclip size={20} />
        </button>

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={loading}
          className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition disabled:opacity-50"
        >
          <ImageIcon size={20} />
        </button>

        <input
          placeholder="Type a message..."
          value={inputText}
          onChange={handleInputChange}
          disabled={loading}
          className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
        />

        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition shadow-md border border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}