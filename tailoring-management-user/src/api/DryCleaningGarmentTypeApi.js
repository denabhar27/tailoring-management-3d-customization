import { API_BASE_URL } from './config';

const API_URL = API_BASE_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export const getAllDCGarmentTypes = async () => {
  try {
    const response = await fetch(`${API_URL}/api/dc-garment-types`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching DC garment types:', error);
    return { success: false, message: error.message };
  }
};

export const getAllDCGarmentTypesAdmin = async () => {
  try {
    const response = await fetch(`${API_URL}/api/dc-garment-types/admin/all`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching DC garment types (admin):', error);
    return { success: false, message: error.message };
  }
};

export const getDCGarmentTypeById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/dc-garment-types/${id}`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching DC garment type:', error);
    return { success: false, message: error.message };
  }
};

export const createDCGarmentType = async (garmentData) => {
  try {
    const response = await fetch(`${API_URL}/api/dc-garment-types`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(garmentData)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating DC garment type:', error);
    return { success: false, message: error.message };
  }
};

export const updateDCGarmentType = async (id, garmentData) => {
  try {
    const response = await fetch(`${API_URL}/api/dc-garment-types/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(garmentData)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating DC garment type:', error);
    return { success: false, message: error.message };
  }
};

export const deleteDCGarmentType = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/dc-garment-types/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting DC garment type:', error);
    return { success: false, message: error.message };
  }
};

export const deactivateDCGarmentType = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/dc-garment-types/${id}/deactivate`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deactivating DC garment type:', error);
    return { success: false, message: error.message };
  }
};

