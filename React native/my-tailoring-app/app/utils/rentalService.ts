
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.202:5000/api';

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
    
    const response = await fetch(url, config);
    
    console.log('Rental API Response Status:', response.status);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.log('Rental API Error Data:', errorData);
      } catch (jsonError) {
        console.log('Rental API Response Text:', await response.text());
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Rental API Success Result:', result);
    return result;
  } catch (error) {
    console.error('Rental API call error:', error);
    throw error;
  }
};

export const rentalService = {
  
  getAvailableRentals: async () => {
    return rentalApiCall('/user/rentals');
  },

  getRentalById: async (itemId: string) => {
    return rentalApiCall(`/user/rentals/${itemId}`);
  },

  getFeaturedRentals: async () => {
    return rentalApiCall('/user/rentals/featured');
  },

  getRentalsByCategory: async (category: string) => {
    return rentalApiCall(`/user/rentals/category/${category}`);
  },

  searchRentals: async (query: string) => {
    return rentalApiCall(`/user/rentals/search?query=${encodeURIComponent(query)}`);
  },

  getCategories: async () => {
    return rentalApiCall('/user/rentals/categories');
  },

  getSimilarRentals: async (itemId: string) => {
    return rentalApiCall(`/user/rentals/${itemId}/similar`);
  },

  getImageUrl: (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const cleanUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${API_BASE_URL.replace('/api', '')}${cleanUrl}`;
  }
};

export default rentalService;
