import axios from "axios";
import { getToken } from "./AuthApi";
import { API_URL } from './config';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export async function createWalkInDryCleaningOrder(orderData) {
  try {
    const response = await axios.post(`${BASE_URL}/walk-in-orders/dry-cleaning`, orderData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Create walk-in dry cleaning order error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating walk-in dry cleaning order"
    };
  }
}

export async function createWalkInRepairOrder(orderData) {
  try {
    const response = await axios.post(`${BASE_URL}/walk-in-orders/repair`, orderData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Create walk-in repair order error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating walk-in repair order"
    };
  }
}

export async function createWalkInCustomizationOrder(orderData) {
  try {
    const token = getToken();

    if (orderData.referenceImage) {
      const formData = new FormData();
      formData.append('customerName', orderData.customerName);
      formData.append('customerEmail', orderData.customerEmail || '');
      formData.append('customerPhone', orderData.customerPhone);
      formData.append('garmentType', orderData.garmentType);
      formData.append('fabricType', orderData.fabricType || '');
      formData.append('patternType', orderData.patternType || '');
      formData.append('measurements', JSON.stringify(orderData.measurements));
      formData.append('preferredDate', orderData.preferredDate || '');
      formData.append('preferredTime', orderData.preferredTime || '');
      formData.append('estimatedPrice', orderData.estimatedPrice || '0');
      formData.append('notes', orderData.notes || '');
      formData.append('referenceImage', orderData.referenceImage);

      const response = await axios.post(`${BASE_URL}/walk-in-orders/customization`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } else {

      const response = await axios.post(`${BASE_URL}/walk-in-orders/customization`, orderData, {
        headers: getAuthHeaders()
      });
      return response.data;
    }
  } catch (error) {
    console.error("Create walk-in customization order error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating walk-in customization order"
    };
  }
}

export async function createWalkInRentalOrder(orderData) {
  try {
    const response = await axios.post(`${BASE_URL}/walk-in-orders/rental`, orderData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Create walk-in rental order error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating walk-in rental order"
    };
  }
}

export async function getAllWalkInOrders() {
  try {
    const response = await axios.get(`${BASE_URL}/walk-in-orders`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get all walk-in orders error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching walk-in orders",
      orders: []
    };
  }
}

export async function getWalkInOrderById(orderId) {
  try {
    const response = await axios.get(`${BASE_URL}/walk-in-orders/${orderId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get walk-in order by ID error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching walk-in order"
    };
  }
}

export async function searchWalkInCustomers(searchTerm) {
  try {
    const response = await axios.get(`${BASE_URL}/walk-in-orders/customers/search`, {
      params: { search: searchTerm },
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Search walk-in customers error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error searching customers",
      customers: []
    };
  }
}

