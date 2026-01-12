import React, { useState } from "react";
import { Bell, User, LogOut, Moon, Sun, MessageSquare,FlaskConical } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import ProfileModal from "./ProfileModal";
import NotificationPopup from "./NotificationPopup";
import logo from "../assets/chat.png"
export default function Header({ notifications, onNotificationClick }) {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.length;

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl shadow-md px-6 py-2 flex items-center justify-between">
        {/* Logo + Name */}
        <div className="flex items-center gap-2">
          
            {/* <MessageSquare className="text-white" size={24} /> */}
            <img src={logo} alt="ChatLab Logo" className="w-8 h-8" />
          
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
            Chat<span className="text-blue-500">Lab</span>
          </h1>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 text-gray-800 dark:text-white">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            {isDark ? (
              <Sun className="text-yellow-400" size={22} />
            ) : (
              <Moon className="text-gray-700" size={22} />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition relative"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <NotificationPopup
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              notifications={notifications}
              onNotificationClick={onNotificationClick}
            />
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              {user?.profilePhoto ? (
                <img
                  src={user.profilePhoto}
                  alt={user.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="font-medium hidden sm:inline">
                {user?.username}
              </span>
            </button>

            <button
              onClick={logout}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded-lg transition"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </>
  );
}