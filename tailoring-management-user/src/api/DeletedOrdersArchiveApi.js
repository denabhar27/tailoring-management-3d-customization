import axios from 'axios';
import { API_URL } from './config';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export async function getDeletedOrdersArchive(params = {}) {
  try {
    const response = await axios.get(`${BASE_URL}/orders/archive/deleted`, {
      headers: getAuthHeaders(),
      params
    });

    return response.data;
  } catch (error) {
    console.error('Get deleted orders archive error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error fetching deleted orders archive',
      orders: []
    };
  }
}
