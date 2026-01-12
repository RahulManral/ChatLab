import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const cleanBaseURL = API_URL.endsWith('/') 
  ? API_URL.slice(0, -1) 
  : API_URL;

const api = axios.create({
  baseURL: `${cleanBaseURL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token"); // Changed from localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });

    if (error.response?.status === 401) {
      sessionStorage.removeItem("token"); // Changed from localStorage
      sessionStorage.removeItem("user"); // Changed from localStorage
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;