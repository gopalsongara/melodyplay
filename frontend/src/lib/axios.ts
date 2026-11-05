import axios from "axios";
import { getApiBaseUrl } from "@/lib/apiConfig";

export const axiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

type TokenGetter = () => Promise<string | null>;

let authTokenGetter: TokenGetter | null = null;

export const setAuthTokenGetter = (getter: TokenGetter | null) => {
  authTokenGetter = getter;
};

axiosInstance.interceptors.request.use(async (config) => {
  // Keep baseURL in sync if the page host changes (LAN vs localhost)
  config.baseURL = getApiBaseUrl();

  if (authTokenGetter) {
    try {
      const token = await authTokenGetter();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }
    } catch {
      delete config.headers.Authorization;
    }
  }
  return config;
});
