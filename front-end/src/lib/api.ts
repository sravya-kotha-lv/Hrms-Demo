import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Function for user registration
export const registerUser = async (formData: any) => {
  try {
    const response = await api.post("/users/register-lender", formData);
    console.log(response, "api res");

    return response;
  } catch (error) {
    throw error;
  }
};

export const LoginUser = async (values: any) => {
    try {
      const response = await api.post("/users/login", values);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

export const postApiWithoutToken = async (apiUrl: string, params: any) => {
  try {
    console.log(apiUrl, params, "apiUrl, params");
    const response = await api.post(apiUrl, params, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log("🚀 ~ postApiWithoutToken ~ response:", response)
    if (response.data.code === 200 && response?.headers?.authorization && apiUrl.includes("/users/login")) {
      localStorage.setItem("token", response?.headers?.authorization);
    }
    return response.data;
  } catch (error) {
    console.log("🚀 ~ postApiWithoutToken ~ error:", error);
  }
};

export const postApiWithToken = async (
  apiUrl: string,
  params: any,
  _headers: any = null
) => {
  try {
    let headers;
    if (_headers) {
      headers = {
        "Content-Type": undefined,
        Authorization: sessionStorage.getItem("token"),
      };
    } else {
      headers = {
        "Content-Type": "application/json",
        Authorization: sessionStorage.getItem("token"),
      };
    }
    const response = await api.post(apiUrl, params, { headers });
    console.log("🚀 ~ postApiWithoutToken ~ response:", response)
    if (
      response.data.code === 200 &&
      response?.headers?.authorization &&
      apiUrl.includes("/users/login")
    ) {
      localStorage.setItem("token", response?.headers?.authorization);
    }
    return response.data;
  } catch (error) {
    console.log("🚀 ~ postApiWithoutToken ~ error:", error);
  }
};

export const getApiWithToken = async (apiUrl: string, _headers: any = null) => {
  try {
    let headers;
    if (_headers) {
      headers = {
        "Content-Type": undefined,
        Authorization: sessionStorage.getItem("token"),
      };
    } else {
      headers = {
        "Content-Type": "application/json",
        Authorization: sessionStorage.getItem("token"),
      };
    }

    const response = await api.get(apiUrl, { headers });
    console.log("🚀 ~ getApiWithToken ~ response:", response);

    return response.data;
  } catch (error) {
    console.log("🚀 ~ getApiWithToken ~ error:", error);
  }
};

