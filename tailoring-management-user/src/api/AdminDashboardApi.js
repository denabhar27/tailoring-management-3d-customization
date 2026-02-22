import axios from "axios";
import { API_URL } from './config';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

export async function getAdminDashboardOverview() {
  try {
    const response = await axios.get(`${BASE_URL}/admin/dashboard`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("Get admin dashboard error:", error);

    const errorMessage = error.response?.data?.message ||
                         error.message ||
                         "Error fetching admin dashboard data";

    return {
      success: false,
      message: errorMessage,
      stats: [],
      recentActivities: [],
    };
  }
}