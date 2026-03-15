const API_BASE_URL = 'http://10.0.2.2:8000/api';

type ApiResponse<T> = {
  success?: boolean;
  code?: number;
  message?: string;
  data?: T;
  error?: unknown;
};

const normalizeToken = (token: string) =>
  token.toLowerCase().startsWith('bearer') ? token : `Bearer ${token}`;

const getAuthHeader = (token: string | null) => {
  if (!token) return {};
  return { Authorization: normalizeToken(token) };
};

const extractAuthToken = (headers: Headers) =>
  headers.get('authorization') || headers.get('Authorization');

const safeJson = async <T>(response: Response): Promise<ApiResponse<T>> => {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      code: response.status,
      message: 'Invalid server response',
    };
  }
};

export const postApiWithoutToken = async <T>(
  path: string,
  payload: Record<string, unknown>
) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson<T>(response);
    return {
      json,
      token: extractAuthToken(response.headers),
    };
  } catch {
    return {
      json: {
        success: false,
        code: 500,
        message: 'Unable to reach server',
      },
      token: null,
    };
  }
};

export const getApiWithToken = async <T>(path: string, token: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
      },
    });
    return await safeJson<T>(response);
  } catch {
    return {
      success: false,
      code: 500,
      message: 'Unable to reach server',
    } as ApiResponse<T>;
  }
};

export const postApiWithToken = async <T>(
  path: string,
  payload: Record<string, unknown>,
  token: string
) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
      },
      body: JSON.stringify(payload),
    });
    return await safeJson<T>(response);
  } catch {
    return {
      success: false,
      code: 500,
      message: 'Unable to reach server',
    } as ApiResponse<T>;
  }
};

export const postApiWithTokenAndAuth = async <T>(
  path: string,
  payload: Record<string, unknown>,
  token: string
) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
      },
      body: JSON.stringify(payload),
    });
    const json = await safeJson<T>(response);
    return {
      json,
      token: extractAuthToken(response.headers),
    };
  } catch {
    return {
      json: {
        success: false,
        code: 500,
        message: 'Unable to reach server',
      },
      token: null,
    };
  }
};

export const putApiWithToken = async <T>(
  path: string,
  payload: Record<string, unknown>,
  token: string
) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
      },
      body: JSON.stringify(payload),
    });
    return await safeJson<T>(response);
  } catch {
    return {
      success: false,
      code: 500,
      message: 'Unable to reach server',
    } as ApiResponse<T>;
  }
};

export const patchApiWithToken = async <T>(
  path: string,
  payload: Record<string, unknown>,
  token: string
) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
      },
      body: JSON.stringify(payload),
    });
    return await safeJson<T>(response);
  } catch {
    return {
      success: false,
      code: 500,
      message: 'Unable to reach server',
    } as ApiResponse<T>;
  }
};
