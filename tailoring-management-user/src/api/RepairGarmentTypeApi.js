import axios from "axios";
import { API_URL } from './config';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export async function getAllRepairGarmentTypes() {
  try {
    const response = await axios.get(`${BASE_URL}/repair-garment-types`);
    return response.data;
  } catch (error) {
    console.error("Get repair garment types error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching repair garment types",
      garments: []
    };
  }
}

export async function getAllRepairGarmentTypesAdmin() {
  try {
    const response = await axios.get(`${BASE_URL}/repair-garment-types/admin`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get repair garment types (admin) error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching repair garment types",
      garments: []
    };
  }
}

export async function createRepairGarmentType(garmentData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/repair-garment-types`,
      garmentData,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Create repair garment type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating repair garment type"
    };
  }
}

export async function updateRepairGarmentType(garmentId, garmentData) {
  try {
    const response = await axios.put(
      `${BASE_URL}/repair-garment-types/${garmentId}`,
      garmentData,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Update repair garment type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating repair garment type"
    };
  }
}

export async function deleteRepairGarmentType(garmentId) {
  try {
    const response = await axios.delete(
      `${BASE_URL}/repair-garment-types/${garmentId}?permanent=true`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Delete repair garment type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error deleting repair garment type"
    };
  }
}

