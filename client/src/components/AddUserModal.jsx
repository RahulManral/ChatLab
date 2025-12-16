import React, { useState } from "react";
import { X, Search, UserPlus, Loader2 } from "lucide-react";
import api from "../utils/api";

export default function AddUserModal({ isOpen, onClose, onUserAdded }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setError("");

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/users/search?query=${query}`);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        setError("No users found with that name");
      }
    } catch (err) {
      setError("Failed to search users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userId) => {
    try {
      const response = await api.post("/users/add-contact", { userId });
      onUserAdded(response.data.conversation);
      setSearchQuery("");
      setSearchResults([]);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add contact");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border-2 border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Add Contact
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search by username..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center mt-4">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          )}

          {/* Search Results */}
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {searchResults.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <div className="flex items-center gap-3">
                  {user.profilePhoto ? (
                    <img
                      src={user.profilePhoto}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {user.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.isOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleAddUser(user._id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition"
                >
                  <UserPlus size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}