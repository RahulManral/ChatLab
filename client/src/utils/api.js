import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Remove trailing slash if present
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
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('Full API URL:', config.baseURL + config.url);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", {
      fullURL: error.config?.baseURL + error.config?.url,
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;