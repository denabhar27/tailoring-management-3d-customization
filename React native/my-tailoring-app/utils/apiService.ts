
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('ENV API URL:', process.env.EXPO_PUBLIC_API_BASE_URL);

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.254.120:5000/api';
console.log('Using API_BASE_URL:', API_BASE_URL);
const REQUEST_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT || '10000', 10);


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
    
 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    try {
      const response = await fetch(url, { ...config, signal: controller.signal });
      clearTimeout(timeoutId);
      
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
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms. Please check your network connection and ensure the backend server is running at ${API_BASE_URL}`);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Auth API functions
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
  
  // Get user profile
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
  },

  // Password Reset Functions
  forgotPassword: async (usernameOrEmail: string) => {
    return apiCall('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail }),
    });
  },

  verifyResetCode: async (code: string, usernameOrEmail: string) => {
    return apiCall('/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify({ code, usernameOrEmail }),
    });
  },

  resetPassword: async (resetToken: string, newPassword: string, confirmPassword: string) => {
    return apiCall('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
    });
  },

  resendResetCode: async (usernameOrEmail: string) => {
    return apiCall('/resend-reset-code', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail }),
    });
  }
};

// Cart API functions
export const cartService = {
  // Get user's cart
  getCart: async () => {
    return apiCall('/cart');
  },
  
  // Add item to cart
  addToCart: async (itemData: any) => {
    return apiCall('/cart', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },
  
  // Remove item from cart
  removeFromCart: async (itemId: string) => {
    return apiCall(`/cart/${itemId}`, {
      method: 'DELETE',
    });
  },
  
  // Submit cart as order (with selected items and notes)
  submitCart: async (notes?: string, selectedCartIds?: string[]) => {
    return apiCall('/cart/submit', {
      method: 'POST',
      body: JSON.stringify({ notes, selectedCartIds }),
    });
  },
  
  // Get cart summary
  getCartSummary: async () => {
    return apiCall('/cart/summary');
  }
};

// Order Tracking API functions
export const orderTrackingService = {
  // Get user's order tracking
  getUserOrderTracking: async () => {
    return apiCall('/tracking');
  },
  
  // Get order item tracking history
  getOrderItemTrackingHistory: async (orderItemId: string) => {
    return apiCall(`/tracking/history/${orderItemId}`);
  },
  
  // Accept price for an order item
  acceptPrice: async (orderItemId: string) => {
    return apiCall(`/orders/${orderItemId}/accept-price`, {
      method: 'POST',
    });
  },
  
  // Decline price for an order item
  declinePrice: async (orderItemId: string) => {
    return apiCall(`/orders/${orderItemId}/decline-price`, {
      method: 'POST',
    });
  }
};

// Notification API functions
export const notificationService = {
  // Get all notifications for the user
  getUserNotifications: async () => {
    return apiCall('/notifications');
  },
  
  // Get unread notifications count
  getUnreadCount: async () => {
    return apiCall('/notifications/unread-count');
  },
  
  // Mark a notification as read
  markAsRead: async (notificationId: string) => {
    return apiCall(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },
  
  // Mark all notifications as read
  markAllAsRead: async () => {
    return apiCall('/notifications/read-all', {
      method: 'PUT',
    });
  },
  
  // Delete a notification
  deleteNotification: async (notificationId: string) => {
    return apiCall(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },
  
  // Delete all notifications
  deleteAllNotifications: async () => {
    return apiCall('/notifications', {
      method: 'DELETE',
    });
  }
};

// Measurements API functions
export const measurementsService = {
  // Get current user's own measurements
  getMyMeasurements: async () => {
    try {
      return await apiCall('/user/measurements');
    } catch (error) {
      console.error('Get my measurements error:', error);
      return {
        success: false,
        message: 'Error fetching measurements',
        measurements: null
      };
    }
  }
};

// Appointment Slot API functions
export const appointmentSlotService = {
  // Get available time slots for a date and service type
  getAvailableSlots: async (serviceType: string, date: string) => {
    return apiCall(`/appointments/available?serviceType=${serviceType}&date=${date}`);
  },
  
  // Get all time slots with availability status (for color-coded calendar display)
  getAllSlotsWithAvailability: async (serviceType: string, date: string, timeout?: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || REQUEST_TIMEOUT);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/appointments/slots-with-availability?serviceType=${serviceType}&date=${date}`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  },
  
  // Book a slot
  bookSlot: async (serviceType: string, date: string, time: string, cartItemId?: string) => {
    return apiCall('/appointments/book', {
      method: 'POST',
      body: JSON.stringify({ serviceType, date, time, cartItemId }),
    });
  },
  
  // Check if a specific slot is available
  checkSlotAvailability: async (serviceType: string, date: string, time: string) => {
    return apiCall(`/appointments/check?serviceType=${serviceType}&date=${date}&time=${time}`);
  },
};

// Transaction Log API functions
export const transactionLogService = {
  // Get transaction logs for an order item
  getTransactionLogsByOrderItem: async (orderItemId: string | number) => {
    return apiCall(`/transaction-logs/order-item/${orderItemId}`);
  },
  
  // Get transaction logs for current user
  getMyTransactionLogs: async () => {
    return apiCall('/transaction-logs/my-logs');
  },
  
  // Get transaction summary for an order item
  getTransactionSummary: async (orderItemId: string | number) => {
    return apiCall(`/transaction-logs/summary/${orderItemId}`);
  }
};

// FAQ API functions
export const faqService = {
  // Get all FAQs
  getAllFAQs: async () => {
    return apiCall('/faqs');
  },
  
  // Get FAQ by ID
  getFAQById: async (id: number) => {
    return apiCall(`/faqs/${id}`);
  },
  
  // Vote on a FAQ (helpful or not helpful)
  voteFAQ: async (faqId: number, isHelpful: boolean) => {
    return apiCall(`/faqs/${faqId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ isHelpful }),
    });
  },
  
  // Get user's votes
  getUserVotes: async () => {
    return apiCall('/faqs/user/votes');
  }
};

// Export the base API call function for other services
export default apiCall;