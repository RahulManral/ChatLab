import React, { createContext, useState, useEffect, useContext } from "react";
import api from "../utils/api";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("token"); // Changed from localStorage
    const savedUser = sessionStorage.getItem("user"); // Changed from localStorage

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data);
    } catch (error) {
      sessionStorage.removeItem("token"); // Changed from localStorage
      sessionStorage.removeItem("user"); // Changed from localStorage
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const response = await api.post("/auth/login", { username, password });
    sessionStorage.setItem("token", response.data.token); // Changed
    sessionStorage.setItem("user", JSON.stringify(response.data.user)); // Changed
    setUser(response.data.user);
    return response.data;
  };

  const register = async (username, password) => {
    const response = await api.post("/auth/register", { username, password });
    sessionStorage.setItem("token", response.data.token); // Changed
    sessionStorage.setItem("user", JSON.stringify(response.data.user)); // Changed
    setUser(response.data.user);
    return response.data;
  };

  const logout = () => {
    sessionStorage.removeItem("token"); // Changed from localStorage
    sessionStorage.removeItem("user"); // Changed from localStorage
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    sessionStorage.setItem("user", JSON.stringify(updatedUser)); // Changed
  };

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, updateUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};