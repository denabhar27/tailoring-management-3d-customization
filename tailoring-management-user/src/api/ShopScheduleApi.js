import axios from 'axios';
import { getToken } from './AuthApi';
import { API_URL } from './config';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const getShopSchedule = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/shop-schedule`);
    return response.data;
  } catch (error) {
    console.error('Get shop schedule error:', error);
    throw error;
  }
};

export const getShopScheduleAdmin = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/shop-schedule/admin`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Get shop schedule admin error:', error);
    throw error;
  }
};

export const updateShopSchedule = async (schedule) => {
  try {
    const response = await axios.put(`${BASE_URL}/shop-schedule/admin`,
      { schedule },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Update shop schedule error:', error);
    throw error;
  }
};

export const checkDateOpen = async (date) => {
  try {
    const response = await axios.get(`${BASE_URL}/shop-schedule/check`, {
      params: { date }
    });
    return response.data;
  } catch (error) {
    console.error('Check date open error:', error);
    throw error;
  }
};

