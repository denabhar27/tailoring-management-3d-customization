import axios from 'axios';
import { API_URL as BASE_URL } from './config';

const API_URL = `${BASE_URL}/analytics`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

export const getRevenueOverview = async () => {
  try {
    const response = await axios.get(`${API_URL}/overview`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching revenue overview:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch revenue overview' };
  }
};

export const getRevenueTrend = async (period = 'monthly', startDate = null, endDate = null, serviceTypes = []) => {
  try {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (serviceTypes.length > 0) {
      serviceTypes.forEach(type => params.append('serviceTypes', type));
    }
    
    const response = await axios.get(`${API_URL}/trend?${params.toString()}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching revenue trend:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch revenue trend' };
  }
};

export const getRevenueByService = async (startDate = null, endDate = null, paymentStatus = 'paid', serviceTypes = []) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (paymentStatus) params.append('paymentStatus', paymentStatus);
    if (serviceTypes && serviceTypes.length > 0) {
      serviceTypes.forEach(type => params.append('serviceTypes', type));
    }
    
    const response = await axios.get(`${API_URL}/by-service?${params.toString()}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching revenue by service:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch revenue by service' };
  }
};

export const getTopServices = async (startDate = null, endDate = null, limit = 10, serviceTypes = []) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('limit', limit);
    if (serviceTypes && serviceTypes.length > 0) {
      serviceTypes.forEach(type => params.append('serviceTypes', type));
    }
    
    const response = await axios.get(`${API_URL}/top-services?${params.toString()}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching top services:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch top services' };
  }
};

export const getRevenueComparison = async (period = 'monthly') => {
  try {
    const response = await axios.get(`${API_URL}/comparison?period=${period}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching revenue comparison:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch revenue comparison' };
  }
};

export const getTopCustomers = async (startDate = null, endDate = null, limit = 10) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('limit', limit);
    
    const response = await axios.get(`${API_URL}/top-customers?${params.toString()}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching top customers:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch top customers' };
  }
};

export const getDetailedAnalytics = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.orderType) params.append('orderType', filters.orderType);
    if (filters.serviceTypes && filters.serviceTypes.length > 0) {
      filters.serviceTypes.forEach(type => params.append('serviceTypes', type));
    }
    
    const response = await axios.get(`${API_URL}/detailed?${params.toString()}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching detailed analytics:', error);
    return { success: false, message: error.response?.data?.message || 'Failed to fetch detailed analytics' };
  }
};
