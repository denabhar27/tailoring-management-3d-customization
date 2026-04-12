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

    if (data?.token) {
      localStorage.setItem("token", data.token);
      if (data.role) {
        localStorage.setItem("role", data.role);
      }

      const userData = data.user || data.admin;
      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
      }
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
  const rawToken = localStorage.getItem("token")
    || localStorage.getItem("authToken")
    || localStorage.getItem("accessToken");

  if (!rawToken) return null;

  const token = String(rawToken).trim();
  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }

  return token;
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

const decodeJwtPayload = (token) => {
  try {
    const payloadPart = String(token || '').split('.')[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to decode JWT payload:', error);
    return null;
  }
};

export function completeGoogleLogin(token, roleFromQuery) {
  if (!token) {
    return { success: false, message: 'Missing authentication token.' };
  }

  try {
    const payload = decodeJwtPayload(token) || {};
    const role = roleFromQuery || payload.role || 'user';

    const user = {
      id: payload.id,
      first_name: payload.first_name || '',
      middle_name: payload.middle_name || '',
      last_name: payload.last_name || '',
      email: payload.email || '',
      phone_number: payload.phone_number || null,
      profile_picture: payload.profile_picture || null,
      role
    };

    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('user', JSON.stringify(user));

    return { success: true, role, user };
  } catch (error) {
    console.error('Error completing Google login:', error);
    return { success: false, message: 'Failed to save Google login session.' };
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

export async function uploadProfilePicture(file) {
  try {
    const token = getToken();
    if (!token) {
      return {
        success: false,
        message: "Authentication required. Please log in again."
      };
    }

    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await axios.put(`${BASE_URL}/profile-picture`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    const data = response.data;

    if (data.success && data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return data;
  } catch (error) {
    console.error("Upload profile picture error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error uploading profile picture"
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