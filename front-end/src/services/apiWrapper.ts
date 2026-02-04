import axios from "axios";
import { toast } from "sonner";
import { getToken, setToken, clearAuth, getProfile, setProfile } from "../utils/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});
/* ================= REQUEST ================= */
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = token.includes("Bearer") ? token : `Bearer ${token}`;
  }
  return config;
});

/* ================= RESPONSE ================= */
api.interceptors.response.use(
  (response) => {
    // ✅ Capture token from ANY response (login / switch-role)
    console.log(response,"----");
    
    const authHeader = response.headers?.authorization;
    if (authHeader) {
      setToken(authHeader);
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;

    if (status === 403) {
      toast.error("You do not have access");
      // window.location.href = "/no-access";
    }

    // if (status === 401) {
    //   toast.error("Session expired. Please login again");
    //   clearAuth();
    //   window.location.href = "/login";
    // }

    return Promise.reject(error);
  }
);
/* ================================
   API FUNCTIONS (UNCHANGED NAMES)
================================ */

// User registration
export const registerUser = async (formData: any) => {
  const response = await api.post("/users/register-lender", formData);
  return response;
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
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.response) return error.response.data;
    return { code: 500, message: "Unknown error occurred" };
  }
};

// POST with token
export const postApiWithToken = async (
  apiUrl: string,
  params: any,
  _headers: any = null
) => {
  try {
    const headers = _headers
      ? { "Content-Type": undefined }
      : { "Content-Type": "application/json" };

    const response = await api.post(apiUrl, params, { headers });
    return response.data;
  } catch (error: any) {
    if (error.response) return error.response.data;
    return { code: 500, message: "Unknown error occurred" };
  }
};

// GET with token
export const getApiWithToken = async (apiUrl: string, _headers: any = null) => {
  try {
    const headers = _headers
      ? { "Content-Type": undefined }
      : { "Content-Type": "application/json" };

    const response = await api.get(apiUrl, { headers });
    return response.data;
  } catch (error: any) {
    return error.response?.data || error;
  }
};

// GET without token
export const getApiWithOutToken = async (apiUrl: string) => {
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
export const putApiWithToken = async (
  apiUrl: string,
  payload: any,
  _headers: any = null
) => {
  try {
    const headers = _headers
      ? { "Content-Type": undefined }
      : { "Content-Type": "application/json" };

    const response = await api.put(apiUrl, payload, { headers });
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
/* ================================
   CONFIG EXPORTS (UNCHANGED)
================================ */

const config = {
  googlePlacesApiKey: import.meta.env.VITE_GOOGLE_PLACES_API_KEY || "",
};

export default config;

export const mapboxConfig = {
  accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "",
};

/* ================================
   UTIL (UNCHANGED)
================================ */

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

// placeholder (safe)
export const switchRole = async (roleId: number) => {
  const response = await api.post("/roles/switch", { roleId });
  return response.data;
};
