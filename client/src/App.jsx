import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ChatBox from "./components/ChatBox";
import Login from "./pages/Login";
import Register from "./pages/Register";
import api from "./utils/api";
import { Loader2 } from "lucide-react";


// DEV MODE: Auto-login configuration
const DEV_MODE = true; // Set to false to enable normal login
const DEV_USER = {
  username: "testuser",
  password: "test123",
};


function MainApp() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get("/messages/conversations");
      const conversationsWithUserId = response.data.map((conv) => ({
        ...conv,
        currentUserId: user.id,
      }));
      setConversations(conversationsWithUserId);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    setActiveConversation(conversation);
    
    // Remove notifications for this conversation
    setNotifications((prev) =>
      prev.filter((notif) => notif.conversationId !== conversation._id)
    );
  };

  const handleNotificationClick = (notification) => {
    const conversation = conversations.find(
      (conv) => conv._id === notification.conversationId
    );
    if (conversation) {
      handleSelectConversation(conversation);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

return (
  <div className="min-h-screen flex justify-center items-center p-4 bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white">
    <div className="mx-8 w-full h-[calc(100vh-2.5rem)] flex bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-300 dark:border-gray-700 shadow-2xl overflow-hidden
      max-w-[480px] xs:max-w-[540px] sm:max-w-[640px] md:max-w-[768px] lg:max-w-[1024px] xl:max-w-[1280px] 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2560px] 5xl:max-w-[3200px] 6xl:max-w-[3840px] 7xl:max-w-[5120px]">
      
      {/* Sidebar - Hidden on mobile, shown on md+ */}
      <div className="hidden md:flex pl-4 pt-4 pb-4">
        <Sidebar
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={handleSelectConversation}
          onConversationsUpdate={fetchConversations}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 p-4 gap-4">
        <Header
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
        />
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={48} />
          </div>
        ) : (
          <ChatBox conversation={activeConversation} />
        )}
      </div>

      {/* Mobile Sidebar Overlay - Show when needed */}
      {activeConversation === null && (
        <div className="md:hidden absolute inset-0 bg-white dark:bg-gray-900 z-40 p-4">
          <Sidebar
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={handleSelectConversation}
            onConversationsUpdate={fetchConversations}
          />
        </div>
      )}
    </div>
  </div>
);
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <SocketProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/register" element={<RegisterRoute />} />
              <Route path="/" element={<MainApp />} />
            </Routes>
          </SocketProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/" /> : <Login />;
}

function RegisterRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/" /> : <Register />;
}




