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

export async function getRepairDamageLevelsByGarmentId(garmentId, includeInactive = false) {
  try {
    const response = await axios.get(
      `${BASE_URL}/repair-garment-types/${garmentId}/damage-levels?includeInactive=${includeInactive ? 'true' : 'false'}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Get repair damage levels error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error fetching repair damage levels',
      damage_levels: []
    };
  }
}

export async function createRepairDamageLevel(garmentId, damageLevelData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/repair-garment-types/${garmentId}/damage-levels`,
      damageLevelData,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Create repair damage level error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error creating repair damage level'
    };
  }
}

export async function updateRepairDamageLevel(garmentId, damageLevelId, damageLevelData) {
  try {
    const response = await axios.put(
      `${BASE_URL}/repair-garment-types/${garmentId}/damage-levels/${damageLevelId}`,
      damageLevelData,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Update repair damage level error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error updating repair damage level'
    };
  }
}

export async function deleteRepairDamageLevel(garmentId, damageLevelId) {
  try {
    const response = await axios.delete(
      `${BASE_URL}/repair-garment-types/${garmentId}/damage-levels/${damageLevelId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Delete repair damage level error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error deleting repair damage level'
    };
  }
}

