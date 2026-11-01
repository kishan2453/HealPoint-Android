import axios from "axios";

const instance = axios.create({
  baseURL: "/",
  headers: { "Content-Type": "application/json" },
});

function isJwtExpired(token) {
  try {
    const parts = (token || "").split(".");
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    if (payload && typeof payload.exp === "number") {
      return payload.exp < Date.now() / 1000;
    }
    return false;
  } catch {
    return false;
  }
}

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
        const raw =
          sessionStorage.getItem("doctorApp") ||
          localStorage.getItem("doctorApp");
        const data = JSON.parse(raw || "null");
        const token = data?.token;
        const msg = String(error.response?.data?.message || "");
        if (!token || isJwtExpired(token) || /expired|invalid/i.test(msg)) {
          sessionStorage.removeItem("doctorApp");
          localStorage.removeItem("doctorApp");
          if (
            typeof window !== "undefined" &&
            !window.location.pathname.startsWith("/login")
          ) {
            window.location.href = "/login";
          }
        }
      } catch {
        // ignore
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
