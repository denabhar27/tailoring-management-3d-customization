
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.202:5000/api'; 

const decodeToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
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

    console.log('API Call:', url, config);
    
    const response = await fetch(url, config);
    
    console.log('API Response Status:', response.status);
    console.log('API Response Headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.log('API Error Data:', errorData);
      } catch (jsonError) {
        console.log('API Response Text:', await response.text());
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('API Success Result:', result);
    return result;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

export const authService = {
  login: async (username: string, password: string) => {
    return apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  
  register: async (userData: {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    password: string;
    phone_number: string;
  }) => {
    return apiCall('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
  
  updateProfile: async (userData: any) => {
    return apiCall('/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  getProfile: async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const decoded = decodeToken(token);
      if (!decoded) {
        throw new Error('Invalid authentication token');
      }
      
      return {
        success: true,
        user: {
          id: decoded.id,
          first_name: decoded.first_name || '',
          last_name: decoded.last_name || '',
          email: decoded.email || '',
          phone_number: decoded.phone_number || ''
        }
      };
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  },
  
  updateProfilePicture: async (formData: FormData) => {
    const token = await AsyncStorage.getItem('userToken');
    return fetch(`${API_BASE_URL}/profile-picture`, {
      method: 'PUT',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
  }
};

export const cartService = {
  
  getCart: async () => {
    return apiCall('/cart');
  },

  addToCart: async (itemData: any) => {
    return apiCall('/cart', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  removeFromCart: async (itemId: string) => {
    return apiCall(`/cart/${itemId}`, {
      method: 'DELETE',
    });
  },

  submitCart: async (notes?: string) => {
    return apiCall('/cart/submit', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  getCartSummary: async () => {
    return apiCall('/cart/summary');
  }
};

export const orderTrackingService = {
  
  getUserOrderTracking: async () => {
    return apiCall('/tracking');
  },

  getOrderItemTrackingHistory: async (orderItemId: string) => {
    return apiCall(`/tracking/history/${orderItemId}`);
  },

  acceptPrice: async (orderItemId: string) => {
    return apiCall(`/orders/${orderItemId}/accept-price`, {
      method: 'POST',
    });
  },

  declinePrice: async (orderItemId: string) => {
    return apiCall(`/orders/${orderItemId}/decline-price`, {
      method: 'POST',
    });
  }
};

export const notificationService = {
  
  getUserNotifications: async () => {
    return apiCall('/notifications');
  },

  getUnreadCount: async () => {
    return apiCall('/notifications/unread-count');
  },

  markAsRead: async (notificationId: string) => {
    return apiCall(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  markAllAsRead: async () => {
    return apiCall('/notifications/read-all', {
      method: 'PUT',
    });
  },

  deleteNotification: async (notificationId: string) => {
    return apiCall(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  deleteAllNotifications: async () => {
    return apiCall('/notifications', {
      method: 'DELETE',
    });
  }
};

export default apiCall;