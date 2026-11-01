import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_BASEURL ||
  (import.meta.env.DEV ? "http://localhost:8080/api/v1" : null);

if (!API_BASE_URL) {
  throw new Error(
    "HealPoint API base URL is missing. Set VITE_BASEURL on Vercel to your deployed backend API URL (e.g. https://your-api-domain.com/api/v1)."
  );
}

const API = axios.create({
  baseURL: API_BASE_URL,
});

function isJwtExpired(token) {
  try {
    const raw = (token || "").replace(/^Bearer\s+/i, "");
    const parts = raw.split(".");
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

API.interceptors.request.use(
  (config) => {
    try {
      const localData = localStorage.getItem("appData");
      if (localData) {
        const appData = JSON.parse(localData);
        if (appData?.token) {
          config.headers.Authorization = appData.token.startsWith("Bearer ")
            ? appData.token
            : `Bearer ${appData.token}`;
        }
      }
    } catch {
      // ignore
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        const localData = localStorage.getItem("appData");
        const appData = localData ? JSON.parse(localData) : null;
        const token = appData?.token;
        const msg = String(error?.response?.data?.message || "");
        if (!token || isJwtExpired(token) || /expired|invalid/i.test(msg)) {
          localStorage.removeItem("appData");
          sessionStorage.clear();
          if (typeof window !== "undefined" && window.location.pathname !== "/") {
            window.location.replace("/");
          }
        }
      } catch {
        // ignore
      }
    }
    return Promise.reject(error);
  }
);

export default API;
