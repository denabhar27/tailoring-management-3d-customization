import axios from "axios";
import { API_URL } from './config';

const BASE_URL = API_URL;

export async function registerUser(userData) {
  try {
    const response = await axios.post(`${BASE_URL}/register`, userData);

    const data = response.data;

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return { success: true, ...data };
  } catch (error) {
    console.error("Register axios error:", error);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.response?.status);

    return {
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Server error during registration. Please check your connection and try again.",
    };
  }
}

export async function loginUser(credentials) {
  try {
    const response = await axios.post(`${BASE_URL}/login`, credentials);
    const data = response.data;

    if (
      data.message === "Login successful" ||
      data.message === "Admin login successful"
    ) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      const userData = data.user || data.admin;
      localStorage.setItem("user", JSON.stringify(userData));
    }

    return data;
  } catch (error) {
    console.error("Login axios error:", error);

    return {
      message: error.response?.data?.message || "Server error during login",
    };
  }
}

export function getToken() {
  return localStorage.getItem("token");
}

export function getUserRole() {
  return localStorage.getItem("role");
}

export function getUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function logoutUser() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
}

export async function getGoogleAuthUrl() {
  try {
    const response = await axios.get(`${BASE_URL}/auth/google`);
    return response.data.authUrl;
  } catch (error) {
    console.error("Google auth URL error:", error);
    throw error;
  }
}

export async function updateProfile(profileData) {
  try {
    const token = getToken();
    if (!token) {
      return {
        success: false,
        message: "Authentication required. Please log in again."
      };
    }

    const response = await axios.put(`${BASE_URL}/profile`, profileData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;

    if (data.success && data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return data;
  } catch (error) {
    console.error("Update profile error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating profile"
    };
  }
}

export async function forgotPassword(usernameOrEmail) {
  try {
    const response = await axios.post(`${BASE_URL}/forgot-password`, {
      usernameOrEmail
    });
    return response.data;
  } catch (error) {
    console.error("Forgot password error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "An error occurred. Please try again."
    };
  }
}

export async function verifyResetCode(code, usernameOrEmail) {
  try {
    const response = await axios.post(`${BASE_URL}/verify-reset-code`, {
      code,
      usernameOrEmail
    });
    return response.data;
  } catch (error) {
    console.error("Verify reset code error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Invalid code. Please try again."
    };
  }
}

export async function resetPassword(resetToken, newPassword, confirmPassword) {
  try {
    const response = await axios.post(`${BASE_URL}/reset-password`, {
      resetToken,
      newPassword,
      confirmPassword
    });
    return response.data;
  } catch (error) {
    console.error("Reset password error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Failed to reset password. Please try again."
    };
  }
}

export async function resendResetCode(usernameOrEmail) {
  try {
    const response = await axios.post(`${BASE_URL}/resend-reset-code`, {
      usernameOrEmail
    });
    return response.data;
  } catch (error) {
    console.error("Resend reset code error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Failed to resend code. Please try again."
    };
  }
}