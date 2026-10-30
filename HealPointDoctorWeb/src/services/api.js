import axios from "axios";

const instance = axios.create({
  baseURL: "/",
  headers: { "Content-Type": "application/json" },
});

instance.interceptors.request.use(
  (config) => {
    try {
      const raw =
        sessionStorage.getItem("doctorApp") ||
        localStorage.getItem("doctorApp");
      const data = JSON.parse(raw || "null");
      const token = data?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore
    }
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        sessionStorage.removeItem("doctorApp");
        localStorage.removeItem("doctorApp");
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login")
        ) {
          window.location.href = "/login";
        }
      } catch {
        // ignore
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
