import axios from 'axios';
import { getToken } from './AuthApi';
import { API_URL } from './config';

const API_BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const getTransactionLogsByOrderItem = async (orderItemId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transaction-logs/order-item/${orderItemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Get transaction logs error:', error);
    throw error;
  }
};

export const getMyTransactionLogs = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transaction-logs/my-logs`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Get my transaction logs error:', error);
    throw error;
  }
};

export const getTransactionSummary = async (orderItemId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transaction-logs/summary/${orderItemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Get transaction summary error:', error);
    throw error;
  }
};

export const getAllTransactionLogs = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transaction-logs/all`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Get all transaction logs error:', error);
    throw error;
  }
};

