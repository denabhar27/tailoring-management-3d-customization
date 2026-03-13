import axios from 'axios';
import { API_URL } from './config';
import { getToken } from './AuthApi';

const BASE = `${API_URL}/admin/clerks`;

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getClerks = async () => {
  try {
    const res = await axios.get(BASE, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    console.error('Fetch clerks error:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to load clerks' };
  }
};

export const createClerk = async (payload) => {
  try {
    const res = await axios.post(BASE, payload, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    console.error('Create clerk error:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to create clerk' };
  }
};

export const updateClerk = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE}/${id}`, payload, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    console.error('Update clerk error:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to update clerk' };
  }
};

export const deactivateClerk = async (id) => {
  try {
    const res = await axios.delete(`${BASE}/${id}`, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    console.error('Deactivate clerk error:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to deactivate clerk' };
  }
};

export const resetClerkPassword = async (id) => {
  try {
    const res = await axios.post(`${BASE}/${id}/reset-password`, {}, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    console.error('Reset clerk password error:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to reset password' };
  }
};
