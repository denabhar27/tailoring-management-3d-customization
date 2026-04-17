
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

console.log('ENV API URL:', process.env.EXPO_PUBLIC_API_BASE_URL);

const resolveExpoHost = (): string | null => {
  const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  if (hostUri) {
    return hostUri.split(':')[0] || null;
  }

  const debuggerHost =
    ((Constants.expoGoConfig as any)?.debuggerHost as string | undefined) ||
    ((Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost as string | undefined) ||
    ((Constants.manifest as any)?.debuggerHost as string | undefined);

  if (debuggerHost) {
    return debuggerHost.split(':')[0] || null;
  }

  return null;
};

const resolveDefaultApiBaseUrl = (): string => {
  const host = resolveExpoHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:5000/api`;
  }

  // Android emulator cannot reach localhost directly; use host loopback alias.
  if (Platform.OS === 'android') {
    return 'http://192.168.1.66:5000/api';
  }

  return 'http://localhost:5000/api';
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || resolveDefaultApiBaseUrl();
console.log('Using API_BASE_URL:', API_BASE_URL);
const REQUEST_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT || '10000', 10);

const PUBLIC_AUTH_ENDPOINTS = [
  '/login',
  '/register',
  '/auth/google',
  '/forgot-password',
  '/verify-reset-code',
  '/reset-password',
  '/resend-reset-code',
];

const isPublicAuthEndpoint = (endpoint: string) => {
  return PUBLIC_AUTH_ENDPOINTS.some(publicEndpoint => endpoint.startsWith(publicEndpoint));
};

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

const getAuthHeaders = async (includeAuth = true) => {
  const token = await AsyncStorage.getItem('userToken');

  // Proactively check for expired token before sending the request
  if (includeAuth && token && isTokenExpired(token)) {
    console.warn('Token expired locally — clearing auth and redirecting to login');
    await handleAuthFailure();
    throw new Error('Session expired. Please log in again.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (includeAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const isPublicRequest = isPublicAuthEndpoint(endpoint);
    const headers = await getAuthHeaders(!isPublicRequest);
    const mergedHeaders: Record<string, string> = {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    };
    if (options.body instanceof FormData) {
      delete mergedHeaders['Content-Type'];
    }

    const config: RequestInit = {
      ...options,
      headers: mergedHeaders,
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

        if (!isPublicRequest) {
          console.warn('Received 401 — clearing auth and redirecting to login');
          await handleAuthFailure();
          throw new Error('Session expired. Please log in again.');
        }

        throw new Error(errorData?.message || 'Unauthorized');
      }

      // Session invalid: customer JWT missing age verification (sign in again)
      if (response.status === 403) {
        let errorData: { message?: string; code?: string } = {};
        try {
          const responseClone403 = response.clone();
          errorData = await responseClone403.json();
        } catch (_) {}

        if (!isPublicRequest && errorData?.code === 'AGE_VERIFICATION_REQUIRED') {
          console.warn('Received 403 AGE_VERIFICATION_REQUIRED — clearing auth');
          await handleAuthFailure();
          throw new Error(errorData?.message || 'Please sign in again.');
        }
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

      if (fetchError instanceof TypeError && /Network request failed/i.test(fetchError.message || '')) {
        throw new Error(`Unable to connect to server at ${API_BASE_URL}. Check that backend is running, your phone/emulator is on the same network, and this API URL is reachable.`);
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
    middle_name?: string | null;
    last_name: string;
    username: string;
    email: string;
    password: string;
    phone_number: string;
    birthdate: string;
  }) => {
    return apiCall('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getGoogleAuthUrl: async (state?: string) => {
    const query = state ? `?state=${encodeURIComponent(state)}` : '';
    return apiCall(`/auth/google${query}`);
  },

  completeGoogleLogin: async (token: string, roleFromQuery?: string) => {
    if (!token) {
      return { success: false, message: 'Missing authentication token.' };
    }

    try {
      const payload = decodeToken(token) || {};
      const role = roleFromQuery || payload.role || 'user';

      const user = {
        id: payload.id,
        first_name: payload.first_name || '',
        middle_name: payload.middle_name || '',
        last_name: payload.last_name || '',
        email: payload.email || '',
        phone_number: payload.phone_number || null,
        profile_picture: payload.profile_picture || null,
        birthdate: payload.birthdate || null,
        role,
      };

      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userRole', role);
      await AsyncStorage.setItem('userData', JSON.stringify(user));

      return { success: true, role, user };
    } catch (error) {
      console.error('Error completing Google login:', error);
      return { success: false, message: 'Failed to save Google login session.' };
    }
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
          middle_name: decoded.middle_name || '',
          last_name: decoded.last_name || '',
          email: decoded.email || '',
          phone_number: decoded.phone_number || '',
          profile_picture: decoded.profile_picture || null,
          birthdate: decoded.birthdate || null
        }
      };
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  },

  updateProfilePicture: async (formData: FormData) => {
    const token = await AsyncStorage.getItem('userToken');

    if (token && isTokenExpired(token)) {
      await handleAuthFailure();
      throw new Error('Session expired. Please log in again.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE_URL}/profile-picture`, {
        method: 'PUT',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      console.log('Profile picture upload response:', response.status, text.substring(0, 200));

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON (status ${response.status}). Please try again.`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Upload timed out. Please check your connection and try again.');
      }
      throw err;
    }
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
  },

  requestEnhancement: async (
    orderItemId: string,
    payload: {
      notes: string;
      preferredCompletionDate?: string | null;
      addAccessories?: boolean;
      photos?: { uri: string; name: string; type: string }[];
    }
  ) => {
    const photos = payload.photos?.filter(Boolean) || [];
    if (photos.length > 0) {
      const formData = new FormData();
      formData.append('notes', payload.notes);
      if (payload.preferredCompletionDate) {
        formData.append('preferredCompletionDate', payload.preferredCompletionDate);
      }
      formData.append('addAccessories', payload.addAccessories ? 'true' : 'false');
      photos.forEach((p) => {
        formData.append('photos', {
          uri: p.uri,
          name: p.name || 'photo.jpg',
          type: p.type || 'image/jpeg',
        } as any);
      });
      return apiCall(`/tracking/request-enhancement/${orderItemId}`, {
        method: 'POST',
        body: formData as unknown as BodyInit,
      });
    }
    return apiCall(`/tracking/request-enhancement/${orderItemId}`, {
      method: 'POST',
      body: JSON.stringify({
        notes: payload.notes,
        preferredCompletionDate: payload.preferredCompletionDate ?? null,
        addAccessories: payload.addAccessories ?? false,
      }),
    });
  },

  cancelOrderItem: async (orderItemId: string, reason: string) => {
    return apiCall(`/orders/items/${orderItemId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
};

export const damageRecordService = {
  getCompensationIncidents: async (params?: { orderItemId?: string | number; myOnly?: boolean; serviceType?: string }) => {
    const query = new URLSearchParams();
    if (params?.orderItemId) query.set('order_item_id', String(params.orderItemId));
    if (params?.myOnly) query.set('my_only', 'true');
    if (params?.serviceType) query.set('service_type', params.serviceType);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiCall(`/damage-records/compensation-incidents${suffix}`);
  },

  submitCustomerLiabilityDecision: async (
    incidentId: string | number,
    payload: {
      liability_status: 'approved' | 'rejected';
      customer_compensation_choice?: 'money' | 'clothe';
      customer_proceed_choice?: 'proceed' | 'dont_proceed';
      notes?: string;
    }
  ) => {
    return apiCall(`/damage-records/compensation-incidents/${incidentId}/customer-liability`, {
      method: 'PUT',
      body: JSON.stringify(payload),
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
      // This is a public endpoint - don't require auth (avoids expired token blocking time slot display)
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token && !isTokenExpired(token)) {
        headers['Authorization'] = `Bearer ${token}`;
      }
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