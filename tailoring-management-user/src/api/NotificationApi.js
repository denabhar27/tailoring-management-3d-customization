import { API_BASE_URL } from './config';

const API_BASE = API_BASE_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const notificationApi = {

  getNotifications: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${API_BASE}/api/notifications`, {
        method: 'GET',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Failed to fetch notifications: ${res.status} ${res.statusText}`);
      }
      return res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout: Backend server may be unavailable. Please check if the server is running.');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION')) {
        throw new Error('Cannot connect to server. Please check if the backend is running and accessible.');
      }
      throw err;
    }
  },

  getUnreadCount: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
        method: 'GET',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Failed to fetch unread count: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return data.count || 0;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout: Backend server may be unavailable.');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('ERR_CONNECTION')) {

        console.warn('Failed to fetch unread count, returning 0:', err.message);
        return 0;
      }
      throw err;
    }
  },

  markAsRead: async (notificationId) => {
    const res = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark as read');
    return res.json();
  },

  markAllAsRead: async () => {
    const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark all as read');
    return res.json();
  },
};
