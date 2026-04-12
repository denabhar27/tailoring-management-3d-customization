import axios from "axios";
import { API_URL } from './config';
import { getToken } from './AuthApi';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

export async function getAllGarmentTypes() {
  try {
    const response = await axios.get(`${BASE_URL}/garment-types`);
    return response.data;
  } catch (error) {
    console.error("Get garment types error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching garment types",
      garments: []
    };
  }
}

export async function getAllGarmentTypesAdmin() {
  try {
    const response = await axios.get(`${BASE_URL}/garment-types/admin`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get garment types (admin) error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching garment types",
      garments: []
    };
  }
}

export async function createGarmentType(garmentData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/garment-types`,
      garmentData,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Create garment type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating garment type"
    };
  }
}

export async function updateGarmentType(garmentId, garmentData) {
  try {
    const response = await axios.put(
      `${BASE_URL}/garment-types/${garmentId}`,
      garmentData,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Update garment type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating garment type"
    };
  }
}

export async function deleteGarmentType(garmentId) {
  try {
    const response = await axios.delete(
      `${BASE_URL}/garment-types/${garmentId}?permanent=true`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Delete garment type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error deleting garment type"
    };
  }
}

