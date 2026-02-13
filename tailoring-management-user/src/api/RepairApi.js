import axios from "axios";

const BASE_URL = "http://localhost:5000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export async function getAllRepairServices() {
  try {
    const response = await axios.get(`${BASE_URL}/repair`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get repair services error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching repair services",
      data: []
    };
  }
}

export async function getRepairServiceById(serviceId) {
  try {
    const response = await axios.get(`${BASE_URL}/repair/${serviceId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get repair service error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching repair service",
      data: null
    };
  }
}

export async function getRepairServicesByDamageLevel(damageLevel) {
  try {
    const response = await axios.get(`${BASE_URL}/repair/damage/${damageLevel}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get repair services by damage level error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching repair services by damage level",
      data: []
    };
  }
}

export async function getPriceEstimate(damageLevel) {
  try {
    const response = await axios.get(`${BASE_URL}/repair/estimate/${damageLevel}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get price estimate error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching price estimate",
      data: []
    };
  }
}

export async function searchRepairServices(searchTerm) {
  try {
    const response = await axios.get(`${BASE_URL}/repair/search?q=${encodeURIComponent(searchTerm)}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Search repair services error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error searching repair services",
      data: []
    };
  }
}

export async function uploadRepairImage(file) {
  try {
    const formData = new FormData();
    formData.append('repairImage', file);

    const response = await axios.post(`${BASE_URL}/repair/upload-image`, formData, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error("Upload repair image error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error uploading repair image"
    };
  }
}

export async function createRepairService(serviceData) {
  try {
    const response = await axios.post(`${BASE_URL}/repair`, serviceData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Create repair service error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating repair service"
    };
  }
}

export async function updateRepairService(serviceId, serviceData) {
  try {
    const response = await axios.put(`${BASE_URL}/repair/${serviceId}`, serviceData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Update repair service error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating repair service"
    };
  }
}

export async function deleteRepairService(serviceId) {
  try {
    const response = await axios.delete(`${BASE_URL}/repair/${serviceId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Delete repair service error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error deleting repair service"
    };
  }
}

export async function addRepairToCart(repairData) {
  try {
    const cartItem = {
      serviceType: 'repair',
      serviceId: null, 
      quantity: 1,
      basePrice: repairData.basePrice,
      finalPrice: repairData.estimatedPrice,
      pricingFactors: {
        damageLevel: repairData.damageLevel,
        estimatedTime: repairData.estimatedTime,
        pickupDate: repairData.pickupDate
      },
      specificData: {
        serviceName: repairData.serviceName,
        imageUrl: repairData.imageUrl,
        pickupDate: repairData.pickupDate,
        uploadedAt: new Date().toISOString(),
        // Multiple garments support
        garments: repairData.garments || [],
        isMultipleGarments: repairData.isMultipleGarments || false,
        // Legacy single-garment fields (for backwards compatibility)
        damageLevel: repairData.garments?.[0]?.damageLevel || repairData.damageLevel,
        garmentType: repairData.garments?.[0]?.garmentType || repairData.garmentType,
        damageDescription: repairData.garments?.[0]?.notes || repairData.damageDescription,
        damageLocation: repairData.damageLocation
      }
    };

    const { addToCart } = await import('./CartApi');
    return await addToCart(cartItem);
  } catch (error) {
    console.error("Add repair to cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error adding repair service to cart"
    };
  }
}
