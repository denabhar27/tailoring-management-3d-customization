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

export async function getAvailableSlots(serviceType, date) {
  try {
    const response = await axios.get(`${BASE_URL}/appointments/available`, {
      params: { serviceType, date }
    });
    return response.data;
  } catch (error) {
    console.error("Get available slots error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching available slots",
      slots: []
    };
  }
}

export async function getAllSlotsWithAvailability(serviceType, date) {
  try {
    const response = await axios.get(`${BASE_URL}/appointments/slots-with-availability`, {
      params: { serviceType, date }
    });
    return response.data;
  } catch (error) {
    console.error("Get slots with availability error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching slot availability",
      slots: [],
      isShopOpen: true
    };
  }
}

export async function checkSlotAvailability(serviceType, date, time) {
  try {
    const response = await axios.get(`${BASE_URL}/appointments/check`, {
      params: { serviceType, date, time }
    });
    return response.data;
  } catch (error) {
    console.error("Check slot availability error:", error);
    return {
      success: false,
      available: false,
      message: error.response?.data?.message || "Error checking slot availability"
    };
  }
}

export async function bookSlot(serviceType, date, time, cartItemId = null) {
  try {

    let formattedTime = time;
    if (time && !time.includes(':')) {
      formattedTime = time;
    } else if (time && time.split(':').length === 2) {
      formattedTime = time + ':00';
    }

    const response = await axios.post(
      `${BASE_URL}/appointments/book`,
      { serviceType, date, time: formattedTime, cartItemId },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Book slot error:", error);
    console.error("Error details:", error.response?.data);
    return {
      success: false,
      message: error.response?.data?.message || error.message || "Error booking slot"
    };
  }
}

export async function cancelSlot(slotId) {
  try {
    const response = await axios.delete(
      `${BASE_URL}/appointments/cancel/${slotId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Cancel slot error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error cancelling slot"
    };
  }
}

export async function getUserSlots() {
  try {
    const response = await axios.get(
      `${BASE_URL}/appointments/user-slots`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Get user slots error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching user slots",
      slots: []
    };
  }
}

