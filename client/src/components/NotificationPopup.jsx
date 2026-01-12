import React from "react";
import { X, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NotificationPopup({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-14 right-0 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
          Notifications
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X size={20} />
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <MessageCircle size={48} className="mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notification, index) => (
              <div
                key={index}
                onClick={() => {
                  onNotificationClick(notification);
                  onClose();
                }}
                className="p-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
                    <MessageCircle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      {notification.message?.sender?.username || "Unknown"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {notification.message?.content || "New message"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {formatDistanceToNow(
                        new Date(notification.message?.createdAt),
                        { addSuffix: true }
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}