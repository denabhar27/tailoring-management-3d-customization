
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as MAIN_API_URL } from './apiService';

const API_BASE_URL = MAIN_API_URL;
const REQUEST_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT || '10000', 10);

const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

const rentalApiCall = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getAuthHeaders();

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    console.log('Rental API Call:', url, config);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, { ...config, signal: controller.signal });
      clearTimeout(timeoutId);

      console.log('Rental API Response Status:', response.status);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.log('Rental API Error Data:', errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.log('Could not parse error response as JSON');
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Rental API Success Result:', result);
      return result;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms. Please check your network connection.`);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Rental API call error:', error);
    throw error;
  }
};

export const rentalService = {

  getAvailableRentals: async () => {
    return rentalApiCall('/rentals/available');
  },

  getRentalById: async (itemId: string) => {
    return rentalApiCall(`/rentals/${itemId}`);
  },

  getFeaturedRentals: async () => {
    return rentalApiCall('/rentals');
  },

  getRentalsByCategory: async (category: string) => {
    return rentalApiCall(`/rentals/category/${category}`);
  },

  searchRentals: async (query: string) => {
    return rentalApiCall(`/rentals/search?query=${encodeURIComponent(query)}`);
  },

  getCategories: async () => {
    return rentalApiCall('/rentals/categories');
  },

  getSimilarRentals: async (itemId: string) => {
    return rentalApiCall(`/rentals/${itemId}/similar`);
  },

  getImageUrl: (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const cleanUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${API_BASE_URL.replace('/api', '')}${cleanUrl}`;
  }
};

export default rentalService;
