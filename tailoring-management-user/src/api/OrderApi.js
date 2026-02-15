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

export async function getOrderItemDetails(orderItemId) {
  try {
    const response = await axios.get(`${BASE_URL}/orders/items/${orderItemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching order item details:', error);
    throw error;
  }
}

export async function getUserOrders() {
  try {
    const response = await axios.get(`${BASE_URL}/orders`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user orders:', error);
    throw error;
  }
}

export async function deleteOrderItem(itemId) {
  try {
    const response = await axios.delete(`${BASE_URL}/orders/items/${itemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting order item:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error deleting order item'
    };
  }
}
