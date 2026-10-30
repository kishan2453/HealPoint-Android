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

API.interceptors.request.use(
  async (config) => {
    try {
      const localData = await localStorage.getItem("appData");
      const appData = JSON.parse(localData);
      if (appData?.token) {
        config.headers.Authorization = appData.token.startsWith("Bearer ")
          ? appData.token
          : `Bearer ${appData.token}`;
      }
    } catch {
      localStorage.removeItem("appData");
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
      localStorage.removeItem("appData");
      sessionStorage.clear();
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }
    return Promise.reject(error);
  }
);

export default API;
