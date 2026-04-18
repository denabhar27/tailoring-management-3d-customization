
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiCall from './apiService';
import { API_BASE_URL } from './apiService';

const REQUEST_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT || '10000', 10);

export const uploadRepairImage = async (formData: FormData) => {
  const token = await AsyncStorage.getItem('userToken');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}/repair/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const addRepairToCart = async (repairData: any) => {

  const cartData = {
    serviceType: repairData.serviceType || 'repair',
    serviceId: repairData.serviceId || 1,
    quantity: repairData.quantity || 1,
    basePrice: repairData.basePrice || repairData.estimatedPrice || '0',
    finalPrice: repairData.finalPrice || repairData.estimatedPrice || '0',
    pricingFactors: repairData.pricingFactors || {},
    specificData: {
      serviceName: repairData.serviceName,
      damageLevel: repairData.damageLevel,
      damageDescription: repairData.damageDescription,
      damageLocation: repairData.damageLocation,
      garmentType: repairData.garmentType,
      pickupDate: repairData.pickupDate,
      imageUrl: repairData.imageUrl,
      estimatedTime: repairData.estimatedTime,
      ...repairData
    },
    rentalDates: repairData.rentalDates || null
  };

  return apiCall('/cart', {
    method: 'POST',
    body: JSON.stringify(cartData),
  });
};

export const getPriceEstimate = async (damageLevel: string) => {
  return apiCall(`/repair/estimate/${damageLevel}`);
};