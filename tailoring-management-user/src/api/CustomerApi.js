import axios from "axios";
import { API_URL } from './config';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export async function getAllCustomers() {
  try {
    const response = await axios.get(`${BASE_URL}/customers`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get customers error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching customers",
      customers: []
    };
  }
}

export async function getCustomerById(customerId, customerType = 'online') {
  try {
    const response = await axios.get(`${BASE_URL}/customers/${customerId}`, {
      headers: getAuthHeaders(),
      params: { customer_type: customerType }
    });
    return response.data;
  } catch (error) {
    console.error("Get customer error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching customer"
    };
  }
}

export async function updateCustomer(customerId, customerData) {
  try {
    const response = await axios.put(`${BASE_URL}/customers/${customerId}`, customerData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Update customer error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating customer"
    };
  }
}

export async function updateCustomerStatus(customerId, status) {
  try {
    const response = await axios.patch(`${BASE_URL}/customers/${customerId}/status`, { status }, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Update customer status error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating customer status"
    };
  }
}

export async function saveMeasurements(customerId, measurements) {
  try {
    const response = await axios.post(`${BASE_URL}/customers/${customerId}/measurements`, measurements, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Save measurements error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error saving measurements"
    };
  }
}

export async function getMeasurements(customerId, customerType = 'online') {
  try {
    const response = await axios.get(`${BASE_URL}/customers/${customerId}/measurements`, {
      headers: getAuthHeaders(),
      params: { customer_type: customerType }
    });
    return response.data;
  } catch (error) {
    console.error("Get measurements error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching measurements"
    };
  }
}

export async function getMyMeasurements() {
  try {
    const response = await axios.get(`${BASE_URL}/user/measurements`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get my measurements error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching measurements",
      measurements: null
    };
  }
}

