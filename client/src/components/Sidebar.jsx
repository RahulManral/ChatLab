import React, { useState, useEffect } from "react";
import { Search, UserPlus, Users, Circle } from "lucide-react";
import { useSocket } from "../context/SocketContext";
import api from "../utils/api";
import AddUserModal from "./AddUserModal";
import CreateGroupModal from "./CreateGroupModal";
import { formatDistanceToNow } from "date-fns";

export default function Sidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onConversationsUpdate,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showOnline, setShowOnline] = useState(true);
  const { onlineUsers } = useSocket();

  const filteredConversations = conversations.filter((conv) => {
    const otherUser = conv.participants.find((p) => p._id !== conv.currentUserId);
    const displayName = conv.isGroup
      ? conv.groupName
      : otherUser?.username || "";

    const matchesSearch = displayName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    
    if (!showOnline) return matchesSearch;

    if (conv.isGroup) return matchesSearch;
    
    return matchesSearch && onlineUsers.has(otherUser?._id);
  });

  const handleUserAdded = (conversation) => {
    onConversationsUpdate();
  };

  const handleGroupCreated = (group) => {
    onConversationsUpdate();
  };

  const isUserOnline = (userId) => onlineUsers.has(userId);

  return (
    <>
      <aside className="w-[250px] md:w-[280px] lg:w-[300px] xl:w-[320px] h-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl flex flex-col p-5 border-2 border-gray-200 dark:border-gray-600 shadow-lg overflow-hidden">
        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg mb-4">
          <Search className="text-gray-400 dark:text-gray-300" size={20} />
          <input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg border border-blue-700 transition shadow-sm"
          >
            <UserPlus size={18} />
            <span className="text-sm">Add</span>
          </button>
          <button
            onClick={() => setShowGroupModal(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg border border-green-700 transition shadow-sm"
          >
            <Users size={18} />
            <span className="text-sm">Group</span>
          </button>
        </div>

        {/* Online/Offline Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowOnline(true)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
              showOnline
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            Online
          </button>
          <button
            onClick={() => setShowOnline(false)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${
              !showOnline
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            All
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <p className="text-sm">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const otherUser = conv.participants.find(
                (p) => p._id !== conv.currentUserId
              );
              const displayName = conv.isGroup
                ? conv.groupName
                : otherUser?.username || "";
              const isOnline = !conv.isGroup && isUserOnline(otherUser?._id);
              const hasUnread = conv.unreadCount > 0;

              return (
                <div
                  key={conv._id}
                  onClick={() => onSelectConversation(conv)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                    activeConversation?._id === conv._id
                      ? "bg-blue-100 dark:bg-blue-900"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {conv.isGroup ? (
                      <div className="w-11 h-11 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        <Users size={20} />
                      </div>
                    ) : otherUser?.profilePhoto ? (
                      <img
                        src={otherUser.profilePhoto}
                        alt={displayName}
                        className="w-11 h-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {displayName[0]?.toUpperCase()}
                      </div>
                    )}
                    {isOnline && (
                      <Circle
                        className="absolute bottom-0 right-0 text-green-500 bg-white dark:bg-gray-800 rounded-full"
                        size={12}
                        fill="currentColor"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`font-medium truncate ${
                          hasUnread
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {displayName}
                      </p>
                      {conv.lastMessage && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {formatDistanceToNow(
                            new Date(conv.lastMessage.createdAt),
                            { addSuffix: false }
                          )}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {conv.lastMessage.sender?.username}:{" "}
                        {conv.lastMessage.content || "Sent a file"}
                      </p>
                    )}
                  </div>

                  {hasUnread && (
                    <div className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUserAdded={handleUserAdded}
      />

      <CreateGroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onGroupCreated={handleGroupCreated}
      />
    </>
  );
}