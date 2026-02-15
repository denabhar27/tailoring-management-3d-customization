import axios from 'axios';
import { getToken } from './AuthApi';
import { API_URL } from './config';

const BASE_URL = API_URL;

export async function getDryCleaningServices() {
  try {
    const response = await axios.get(`${BASE_URL}/dry-cleaning`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Get dry cleaning services error:', error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching dry cleaning services",
      services: []
    };
  }
}

export async function getDryCleaningServiceById(serviceId) {
  try {
    const response = await axios.get(`${BASE_URL}/dry-cleaning/${serviceId}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Get dry cleaning service error:', error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching dry cleaning service",
      service: null
    };
  }
}

export async function uploadDryCleaningImage(file) {
  try {
    const formData = new FormData();
    formData.append('dryCleaningImage', file);

    const response = await axios.post(`${BASE_URL}/dry-cleaning/upload-image`, formData, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Upload dry cleaning image error:', error);
    return {
      success: false,
      message: error.response?.data?.message || "Error uploading image"
    };
  }
}

export async function addDryCleaningToCart(dryCleaningData) {
  try {
    const cartItem = {
      serviceType: 'dry_cleaning',
      serviceId: null, 
      quantity: dryCleaningData.quantity || 1,
      basePrice: dryCleaningData.basePrice,
      finalPrice: dryCleaningData.finalPrice,
      pricingFactors: {
        quantity: dryCleaningData.quantity,
        pricePerItem: dryCleaningData.pricePerItem,
        estimatedTime: dryCleaningData.estimatedTime,
        pickupDate: dryCleaningData.pickupDate
      },
      specificData: {
        serviceName: dryCleaningData.serviceName,
        notes: dryCleaningData.notes,
        imageUrl: dryCleaningData.imageUrl,
        pickupDate: dryCleaningData.pickupDate,
        quantity: dryCleaningData.quantity,
        isEstimatedPrice: dryCleaningData.isEstimatedPrice || false,
        uploadedAt: new Date().toISOString(),
        // Multiple garments support
        garments: dryCleaningData.garments || [],
        isMultipleGarments: dryCleaningData.isMultipleGarments || false,
        // Legacy single-garment fields (for backwards compatibility)
        garmentType: dryCleaningData.garments?.[0]?.garmentType || dryCleaningData.garmentType,
        brand: dryCleaningData.garments?.[0]?.brand || dryCleaningData.brand,
        pricePerItem: dryCleaningData.garments?.[0]?.pricePerItem || dryCleaningData.pricePerItem
      }
    };

    const { addToCart } = await import('./CartApi');
    return await addToCart(cartItem);
  } catch (error) {
    console.error("Add dry cleaning to cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error adding dry cleaning service to cart"
    };
  }
}

export async function searchDryCleaningServices(query) {
  try {
    const response = await axios.get(`${BASE_URL}/dry-cleaning/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Search dry cleaning services error:', error);
    return {
      success: false,
      message: error.response?.data?.message || "Error searching dry cleaning services",
      services: []
    };
  }
}

export async function getDryCleaningPriceEstimate(serviceId, quantity) {
  try {
    const response = await axios.get(`${BASE_URL}/dry-cleaning/estimate/${serviceId}?quantity=${quantity}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Get dry cleaning price estimate error:', error);
    return {
      success: false,
      message: error.response?.data?.message || "Error getting price estimate",
      estimatedPrice: 0
    };
  }
}
