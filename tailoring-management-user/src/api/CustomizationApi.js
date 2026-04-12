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

export async function uploadCustomizationImage(file) {
  try {
    const token = getToken();
    if (!token) {
      return {
        success: false,
        message: 'Authentication required. Please log in again.',
        requiresAuth: true
      };
    }

    const formData = new FormData();
    formData.append('customizationImage', file);

    const response = await axios.post(`${BASE_URL}/customization/upload-image`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error("Upload customization image error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error uploading customization image"
    };
  }
}

export async function getUserCustomizationOrders() {
  try {
    const response = await axios.get(`${BASE_URL}/customization/user`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get user customization orders error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching customization orders",
      orders: []
    };
  }
}

export async function getAllCustomizationOrders() {
  try {
    const response = await axios.get(`${BASE_URL}/customization`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get all customization orders error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching customization orders",
      orders: []
    };
  }
}

export async function getCustomizationStats() {
  try {
    const response = await axios.get(`${BASE_URL}/customization/stats`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get customization stats error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching customization stats",
      stats: {}
    };
  }
}

export async function getCustomizationOrderById(itemId) {
  try {
    const response = await axios.get(`${BASE_URL}/customization/${itemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get customization order error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching customization order",
      order: null
    };
  }
}

export async function updateCustomizationOrderItem(itemId, updateData) {
  try {
    const response = await axios.put(`${BASE_URL}/customization/${itemId}`, updateData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Update customization order error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating customization order"
    };
  }
}

export async function updateCustomizationApprovalStatus(itemId, status) {
  try {
    const response = await axios.put(`${BASE_URL}/customization/${itemId}/status`, { status }, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Update customization status error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating customization status"
    };
  }
}

export async function addCustomizationToCart(customizationData) {
  try {

    const isUniform = customizationData.isUniform || customizationData.garmentType?.toLowerCase() === 'uniform';

    const price = isUniform ? 0 : (customizationData.estimatedPrice || 500);

    const cartItem = {
      serviceType: 'customization',
      serviceId: null,
      quantity: customizationData.garments ? customizationData.garments.length : 1,
      basePrice: price,
      finalPrice: price,
      pricingFactors: {
        fabricType: customizationData.fabricType,
        garmentType: customizationData.garmentType,
        designComplexity: customizationData.designComplexity || 'standard',
        preferredDate: customizationData.preferredDate,
        preferredTime: customizationData.preferredTime,
        isUniform: isUniform
      },
      specificData: {
        garmentType: customizationData.garmentType,
        fabricType: customizationData.fabricType,
        measurements: customizationData.measurements,
        notes: customizationData.notes,
        preferredDate: customizationData.preferredDate,
        preferredTime: customizationData.preferredTime,
        imageUrl: customizationData.imageUrl || 'no-image',
        isUniform: isUniform,
        designData: customizationData.designData || {},
        garments: customizationData.garments || [],
        isMultipleGarments: customizationData.isMultipleGarments || false,
        uploadedAt: new Date().toISOString()
      }
    };

    const { addToCart } = await import('./CartApi');
    return await addToCart(cartItem);
  } catch (error) {
    console.error("Add customization to cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error adding customization to cart"
    };
  }
}

export async function uploadGLBFile(file, modelData) {
  try {
    const token = getToken();
    if (!token) {
      console.error('No token found in localStorage');
      return {
        success: false,
        message: 'Authentication required. Please log in again.'
      };
    }

    console.log('Uploading GLB file:', {
      fileName: file.name,
      fileSize: file.size,
      modelName: modelData.model_name,
      hasToken: !!token
    });

    const formData = new FormData();
    formData.append('glbFile', file);
    formData.append('model_name', modelData.model_name);
    formData.append('model_type', modelData.model_type || 'garment');
    if (modelData.garment_category) formData.append('garment_category', modelData.garment_category);
    if (modelData.description) formData.append('description', modelData.description);

    const response = await axios.post(`${BASE_URL}/customization/upload-glb`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`

      },

      timeout: 60000
    });
    return response.data;
  } catch (error) {
    console.error("Upload GLB file error:", error);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.response?.status);

    if (error.response?.status === 401) {
      return {
        success: false,
        message: 'Authentication failed. Please log in again.',
        requiresAuth: true
      };
    }

    return {
      success: false,
      message: error.response?.data?.message || error.message || "Error uploading GLB file"
    };
  }
}

export async function getAllCustom3DModels() {
  try {
    const response = await axios.get(`${BASE_URL}/customization/custom-models`, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error("Get custom 3D models error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching custom 3D models",
      models: []
    };
  }
}

export async function getCustom3DModelsByType(type) {
  try {
    const response = await axios.get(`${BASE_URL}/customization/custom-models/type/${type}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get custom 3D models by type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching custom 3D models",
      models: []
    };
  }
}

export async function deleteCustom3DModel(modelId) {
  try {
    const response = await axios.delete(`${BASE_URL}/customization/custom-models/${modelId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Delete custom 3D model error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error deleting custom 3D model"
    };
  }
}

export async function updateCustom3DModel(modelId, modelData) {
  try {
    const response = await axios.put(`${BASE_URL}/customization/custom-models/${modelId}`, modelData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Update custom 3D model error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error updating custom 3D model'
    };
  }
}

export async function cancelEnhancement(itemId, reason = '') {
  try {
    const response = await axios.post(`${BASE_URL}/orders/items/${itemId}/cancel-enhancement`, { reason }, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    return { success: false, message: error.response?.data?.message || 'Error cancelling enhancement' };
  }
}
