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

export async function getUserCart() {
  try {
    const response = await axios.get(`${BASE_URL}/cart`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get user cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching cart",
      items: []
    };
  }
}

export async function addToCart(itemData) {
  try {
    const response = await axios.post(`${BASE_URL}/cart`, itemData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Add to cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error adding item to cart"
    };
  }
}

export async function updateCartItem(itemId, updateData) {
  try {
    const response = await axios.put(`${BASE_URL}/cart/${itemId}`, updateData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Update cart item error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating cart item"
    };
  }
}

export async function removeFromCart(itemId) {
  try {
    const response = await axios.delete(`${BASE_URL}/cart/${itemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Remove from cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error removing item from cart"
    };
  }
}

export async function clearCart() {
  try {
    const response = await axios.delete(`${BASE_URL}/cart`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Clear cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error clearing cart"
    };
  }
}

export async function submitCart(notes = '', selectedCartIds = []) {
  try {
    const response = await axios.post(`${BASE_URL}/cart/submit`, { notes, selectedCartIds }, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Submit cart error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error submitting cart"
    };
  }
}

export async function getUserOrders() {
  try {
    const response = await axios.get(`${BASE_URL}/orders`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get orders error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching orders",
      orders: []
    };
  }
}

export async function uploadCartItemFile(file, itemId) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('itemId', itemId);

    const response = await axios.post(`${BASE_URL}/cart/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error("Upload cart file error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error uploading file"
    };
  }
}

export async function getCartSummary() {
  try {
    const response = await axios.get(`${BASE_URL}/cart/summary`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get cart summary error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching cart summary",
      itemCount: 0,
      totalAmount: 0
    };
  }
}
