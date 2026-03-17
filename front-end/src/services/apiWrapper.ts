import axios, { AxiosError, AxiosResponse, RawAxiosRequestHeaders } from "axios";
import { toast } from "sonner";
import { getToken, setToken, hasAnyPermission, clearAuth } from "../utils/auth";
import { setOrgTimeZone } from "../utils/timezone";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

let sessionExpiryHandled = false;

export type ApiResponseEnvelope<TData = unknown> = {
  success?: boolean;
  code?: number;
  message?: string;
  data?: TData;
  skipped?: boolean;
};

type PermissionOptions = { requiredPermissions?: string[] };
type RequestHeaders = RawAxiosRequestHeaders | null;
type CachedResponse = ApiResponseEnvelope<unknown>;

const inflightGetRequests = new Map<string, Promise<CachedResponse>>();
const recentGetResponses = new Map<string, { expiresAt: number; data: CachedResponse }>();
const RECENT_GET_TTL_MS = 1500;

const getRequestCacheKey = (apiUrl: string, headers: Record<string, string | undefined> = {}) =>
  JSON.stringify({
    apiUrl,
    headers: Object.keys(headers)
      .sort()
      .reduce((acc, key) => {
        acc[key] = headers[key];
        return acc;
      }, {} as Record<string, string | undefined>)
  });

const clearGetCaches = () => {
  inflightGetRequests.clear();
  recentGetResponses.clear();
};

const readRecentGetResponse = (cacheKey: string) => {
  const cached = recentGetResponses.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    recentGetResponses.delete(cacheKey);
    return null;
  }
  return cached.data;
};

const rememberRecentGetResponse = (cacheKey: string, data: CachedResponse) => {
  recentGetResponses.set(cacheKey, {
    data,
    expiresAt: Date.now() + RECENT_GET_TTL_MS
  });
};

const syncOrgTimeZoneFromResponse = (response: AxiosResponse<ApiResponseEnvelope<{ timezone?: string; orgSettings?: { timezone?: string } }>>) => {
  const data = response?.data?.data;
  const timeZone = data?.timezone || data?.orgSettings?.timezone;
  if (typeof timeZone === "string" && timeZone) {
    setOrgTimeZone(timeZone);
  }
};

const getHeaders = (headers: RequestHeaders) =>
  headers ? { "Content-Type": undefined } : { "Content-Type": "application/json" };

const permissionDeniedResponse = (): ApiResponseEnvelope<null> => ({
  success: false,
  code: 403,
  message: "Permission denied",
  skipped: true,
  data: null
});

const normalizeApiError = (error: unknown): ApiResponseEnvelope<unknown> => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponseEnvelope<unknown>>;
    return axiosError.response?.data || { code: 500, message: axiosError.message || "Unknown error occurred" };
  }
  if (error && typeof error === "object") {
    return error as ApiResponseEnvelope<unknown>;
  }
  return { code: 500, message: "Unknown error occurred" };
};
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
    const authHeader = response.headers?.authorization;
    if (authHeader) {
      setToken(authHeader);
    }
    syncOrgTimeZoneFromResponse(response);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";

    if (status === 403) {
      toast.error("You do not have access");
      // window.location.href = "/no-access";
    }

    if (
      status === 401 &&
      getToken() &&
      !requestUrl.includes("/users/login") &&
      !sessionExpiryHandled
    ) {
      sessionExpiryHandled = true;
      toast.error("Session expired. Please login again");
      clearAuth();
      if (window.location.pathname !== "/login") {
        window.location.replace("/login?reason=session_expired");
      } else {
        sessionExpiryHandled = false;
      }
    }

    return Promise.reject(error);
  }
);
/* ================================
   API FUNCTIONS (UNCHANGED NAMES)
================================ */

// User registration
export const registerUser = async <TResponse = unknown, TPayload = unknown>(formData: TPayload) => {
  const response = await api.post("/users/register-lender", formData);
  return response as AxiosResponse<TResponse>;
};

// Login
export const LoginUser = async <TResponse = unknown, TPayload = unknown>(values: TPayload) => {
  const response = await api.post<TResponse>("/users/login", values);
  clearGetCaches();
  return response.data;
};

// POST without token
export const postApiWithoutToken = async <TResponse = unknown, TPayload = unknown>(
  apiUrl: string,
  params: TPayload
) => {
  try {
    const response = await api.post<TResponse>(apiUrl, params, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    clearGetCaches();
    return response.data;
  } catch (error) {
    return normalizeApiError(error) as TResponse;
  }
};

// POST with token
export const postApiWithToken = async (
  apiUrl: string,
  params: unknown,
  _headers: RequestHeaders = null,
  options: PermissionOptions = {}
) => {
  try {
    if (options.requiredPermissions && !hasAnyPermission(options.requiredPermissions)) {
      return permissionDeniedResponse();
    }
    const headers = getHeaders(_headers);

    const response = await api.post(apiUrl, params, { headers });
    return response.data;
  } catch (error) {
    return normalizeApiError(error);
  }
};

// GET with token
export const getApiWithToken = async (
  apiUrl: string,
  _headers: RequestHeaders = null,
  options: PermissionOptions = {}
) => {
  try {
    if (options.requiredPermissions && !hasAnyPermission(options.requiredPermissions)) {
      return permissionDeniedResponse();
    }
    const headers = getHeaders(_headers);
    const cacheKey = getRequestCacheKey(apiUrl, headers);
    const cachedResponse = readRecentGetResponse(cacheKey);
    if (cachedResponse !== null) {
      return cachedResponse;
    }
    const existingRequest = inflightGetRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const requestPromise = api
      .get(apiUrl, { headers })
      .then((response) => {
        rememberRecentGetResponse(cacheKey, response.data);
        return response.data;
      })
      .finally(() => {
        inflightGetRequests.delete(cacheKey);
      });

    inflightGetRequests.set(cacheKey, requestPromise);
    return requestPromise;
  } catch (error) {
    return normalizeApiError(error);
  }
};

export const putApiWithToken = async (
  apiUrl: string,
  params: unknown,
  _headers: RequestHeaders = null,
  options: PermissionOptions = {}
) => {
  try {
    if (options.requiredPermissions && !hasAnyPermission(options.requiredPermissions)) {
      return permissionDeniedResponse();
    }
    const headers = getHeaders(_headers);
    const response = await api.put(apiUrl, params, { headers });
    clearGetCaches();
    return response.data;
  } catch (error) {
    return normalizeApiError(error);
  }     
};

export const patchApiWithToken = async (
  apiUrl: string,
  params: unknown = {},
  _headers: RequestHeaders = null,
  options: PermissionOptions = {}
) => {
  try {
    if (options.requiredPermissions && !hasAnyPermission(options.requiredPermissions)) {
      return permissionDeniedResponse();
    }
    const headers = getHeaders(_headers);
    const response = await api.patch(apiUrl, params, { headers });
    clearGetCaches();
    return response.data;
  } catch (error) {
    return normalizeApiError(error);
  }
};


// GET without token
export const getApiWithOutToken = async (apiUrl: string) => {
  try {
    const headers = { "Content-Type": "application/json" };
    const cacheKey = getRequestCacheKey(apiUrl, headers);
    const cachedResponse = readRecentGetResponse(cacheKey);
    if (cachedResponse !== null) {
      return cachedResponse;
    }
    const existingRequest = inflightGetRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const requestPromise = api
      .get(apiUrl, { headers })
      .then((response) => {
        rememberRecentGetResponse(cacheKey, response.data);
        return response.data;
      })
      .finally(() => {
        inflightGetRequests.delete(cacheKey);
      });

    inflightGetRequests.set(cacheKey, requestPromise);
    return requestPromise;
  } catch (error) {
    return normalizeApiError(error);
  }
};

// DELETE with token
export const deleteApiWithToken = async (apiUrl: string) => {
  try { 
    const response = await api.delete(apiUrl, {
      headers: { "Content-Type": "application/json" },
    });
    clearGetCaches();
    return response.data;
  } catch (error) {
    return normalizeApiError(error);
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
  clearGetCaches();
  return response.data;
};
