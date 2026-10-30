import axios from "axios";

const getBaseURL = () => {
  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/api\/v1\/?$/, "");
  }
  if (typeof window !== "undefined") {
    const isHosted =
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";
    if (isHosted) {
      return "https://heal-point-backend.vercel.app";
    }
  }
  return "";
};

const api = axios.create({ baseURL: getBaseURL() });

api.interceptors.request.use((config) => {
  const data = JSON.parse(localStorage.getItem("hospitalAdminApp") || "null");
  if (data?.token) {
    config.headers.Authorization = `Bearer ${data.token}`;
  }
  return config;
});

export default api;
