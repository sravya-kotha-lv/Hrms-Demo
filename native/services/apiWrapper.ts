import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ================= BASE CONFIG ================= */

// const API_BASE_URL = "https://your-api-url.com"; // 👈 CHANGE THIS
const API_BASE_URL = "http://192.168.0.105:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

/* ================= TOKEN HELPERS ================= */

export const getToken = async () => {
  return await AsyncStorage.getItem("token");
};

export const setToken = async (token: string) => {
  await AsyncStorage.setItem("token", token);
};

export const clearAuth = async () => {
  await AsyncStorage.removeItem("token");
};

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = token.includes("Bearer")
      ? token
      : `Bearer ${token}`;
  }
  return config;
});

/* ================= RESPONSE INTERCEPTOR ================= */

api.interceptors.response.use(
  async (response) => {
    const authHeader = response.headers?.authorization;
    if (authHeader) {
      await setToken(authHeader);
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      await clearAuth();
      console.log("Session expired");
      // handle navigation reset in UI layer
    }

    if (status === 403) {
      console.log("Permission denied");
    }

    return Promise.reject(error);
  }
);

/* ================= API FUNCTIONS ================= */

// Register
export const registerUser = async (formData: any) => {
  const response = await api.post("/users/register-lender", formData);
  return response.data;
};

// Login
export const LoginUser = async (values: any) => {
  const response = await api.post("/users/login", values);
  return response.data;
};

// POST without token
export const postApiWithoutToken = async (apiUrl: string, params: any) => {
  try {
    const response = await api.post(apiUrl, params, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    return error.response?.data || { code: 500, message: "Unknown error" };
  }
};

// POST with token
export const postApiWithToken = async (apiUrl: string, params: any) => {
  try {
    const response = await api.post(apiUrl, params, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    return error.response?.data || { code: 500, message: "Unknown error" };
  }
};

// GET with token
export const getApiWithToken = async (apiUrl: string) => {
  try {
    const response = await api.get(apiUrl, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    return error.response?.data || error;
  }
};

// PUT with token
export const putApiWithToken = async (apiUrl: string, params: any) => {
  try {
    const response = await api.put(apiUrl, params, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    return error.response?.data || error;
  }
};

// PATCH with token
export const patchApiWithToken = async (apiUrl: string, params: any = {}) => {
  try {
    const response = await api.patch(apiUrl, params, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    return error.response?.data || error;
  }
};

// DELETE with token
export const deleteApiWithToken = async (apiUrl: string) => {
  try {
    const response = await api.delete(apiUrl, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    return error.response?.data || error;
  }
};

/* ================= UTIL ================= */

export function parseLocalISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const clean = iso.replace(/\.\d+Z?$/, "").replace(/Z$/, "");
  const [datePart, timePart] = clean.split("T");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);
  if ([y, m, d, hh, mm].some((v) => Number.isNaN(v))) return null;
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0);
}

// Role switch
export const switchRole = async (roleId: number) => {
  const response = await api.post("/roles/switch", { roleId });
  return response.data;
};

export default api;