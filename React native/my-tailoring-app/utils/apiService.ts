
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('ENV API URL:', process.env.EXPO_PUBLIC_API_BASE_URL);

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://tailoring-management-3d-customization.onrender.com/api';
console.log('Using API_BASE_URL:', API_BASE_URL);
const REQUEST_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT || '10000', 10);

// Simple auth event system (no Node.js 'events' dependency)
type AuthListener = () => void;
const authListeners: AuthListener[] = [];

export const authEvents = {
  on(_event: string, listener: AuthListener) {
    authListeners.push(listener);
  },
  off(_event: string, listener: AuthListener) {
    const idx = authListeners.indexOf(listener);
    if (idx !== -1) authListeners.splice(idx, 1);
  },
  emit(_event: string) {
    authListeners.forEach(fn => fn());
  },
};

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

const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  // exp is in seconds, Date.now() in ms — add 60s buffer for clock skew
  return decoded.exp * 1000 < Date.now() + 60000;
};

const clearAuthData = async () => {
  await AsyncStorage.multiRemove(['userToken', 'userRole', 'userData']);
};

const handleAuthFailure = async () => {
  await clearAuthData();
  authEvents.emit('authExpired');
};

// Exported helper: returns true if token exists AND is not expired
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await AsyncStorage.getItem('userToken');
  if (!token) return false;
  if (isTokenExpired(token)) {
    await handleAuthFailure();
    return false;
  }
  return true;
};

const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');

  // Proactively check for expired token before sending the request
  if (token && isTokenExpired(token)) {
    console.warn('Token expired locally — clearing auth and redirecting to login');
    await handleAuthFailure();
    throw new Error('Session expired. Please log in again.');
  }

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

      // Handle 401 — token rejected by server
      if (response.status === 401) {
        let errorData;
        try {
          const responseClone = response.clone();
          errorData = await responseClone.json();
          console.log('API 401 Error Data:', errorData);
        } catch (_) {}
        console.warn('Received 401 — clearing auth and redirecting to login');
        await handleAuthFailure();
        throw new Error('Session expired. Please log in again.');
      }

      const responseClone = response.clone();

      if (!response.ok) {
        let errorData;
        try {
          errorData = await responseClone.json();
          console.log('API Error Data:', errorData);
        } catch (jsonError) {
          const textResponse = await response.text();
          console.log('API Response Text:', textResponse);
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
  },

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

  submitCart: async (notes?: string, selectedCartIds?: string[]) => {
    return apiCall('/cart/submit', {
      method: 'POST',
      body: JSON.stringify({ notes, selectedCartIds }),
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

export const measurementsService = {

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

export const appointmentSlotService = {

  getAvailableSlots: async (serviceType: string, date: string) => {
    return apiCall(`/appointments/available?serviceType=${serviceType}&date=${date}`);
  },

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

  bookSlot: async (serviceType: string, date: string, time: string, cartItemId?: string) => {
    return apiCall('/appointments/book', {
      method: 'POST',
      body: JSON.stringify({ serviceType, date, time, cartItemId }),
    });
  },

  checkSlotAvailability: async (serviceType: string, date: string, time: string) => {
    return apiCall(`/appointments/check?serviceType=${serviceType}&date=${date}&time=${time}`);
  },
};

export const transactionLogService = {

  getTransactionLogsByOrderItem: async (orderItemId: string | number) => {
    return apiCall(`/transaction-logs/order-item/${orderItemId}`);
  },

  getMyTransactionLogs: async () => {
    return apiCall('/transaction-logs/my-logs');
  },

  getTransactionSummary: async (orderItemId: string | number) => {
    return apiCall(`/transaction-logs/summary/${orderItemId}`);
  }
};

export const faqService = {

  getAllFAQs: async () => {
    return apiCall('/faqs');
  },

  getFAQById: async (id: number) => {
    return apiCall(`/faqs/${id}`);
  },

  voteFAQ: async (faqId: number, isHelpful: boolean) => {
    return apiCall(`/faqs/${faqId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ isHelpful }),
    });
  },

  getUserVotes: async () => {
    return apiCall('/faqs/user-votes');
  }
};

export default apiCall;