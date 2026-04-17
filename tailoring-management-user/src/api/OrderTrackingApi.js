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

export async function getUserOrderTracking() {
  try {
    const response = await axios.get(`${BASE_URL}/tracking`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get order tracking error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching order tracking",
      data: []
    };
  }
}

export async function getOrderItemTrackingHistory(orderItemId) {
  try {
    const response = await axios.get(`${BASE_URL}/tracking/history/${orderItemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get tracking history error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching tracking history",
      data: null
    };
  }
}

export async function updateTrackingStatus(orderItemId, status, notes) {
  try {
    const response = await axios.post(`${BASE_URL}/tracking/update/${orderItemId}`,
      { status, notes },
      {
        headers: getAuthHeaders()
      }
    );
    return response.data;
  } catch (error) {
    console.error("Update tracking status error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating tracking status"
    };
  }
}

export async function getStatusTransitions(orderItemId) {
  try {
    const response = await axios.get(`${BASE_URL}/tracking/transitions/${orderItemId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Get status transitions error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching status transitions",
      data: null
    };
  }
}

export function getStatusBadgeClass(status) {
  const statusMap = {
    'pending': 'pending',
    'accepted': 'accepted',
    'price_confirmation': 'price-confirmation',
    'in_progress': 'in-progress',
    'ready_to_pickup': 'ready',
    'picked_up': 'picked-up',
    'rented': 'rented',
    'returned': 'returned',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'price_declined': 'cancelled'
  };
  return statusMap[status] || 'unknown';
}

export function getStatusLabel(status) {
  const statusMap = {
    'pending': 'Pending',
    'accepted': 'Accepted',
    'price_confirmation': 'Price Confirmation',
    'in_progress': 'In Progress',
    'ready_to_pickup': 'Ready to Pickup',
    'picked_up': 'Picked Up',
    'rented': 'Rented',
    'returned': 'Returned',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'price_declined': 'Price Declined'
  };
  return statusMap[status] || status;
}

export function getServiceStatusFlow(serviceType) {
  const flows = {
    'repair': ['pending', 'accepted', 'in_progress', 'ready_to_pickup'],
    'customize': ['pending', 'accepted', 'in_progress', 'ready_to_pickup'],
    'dry_cleaning': ['pending', 'accepted', 'in_progress', 'ready_to_pickup'],
    'rental': ['pending', 'picked_up', 'rented', 'returned', 'completed']
  };
  return flows[serviceType] || flows['repair'];
}

export async function cancelOrderItem(orderItemId, reason) {
  try {
    const response = await axios.post(
      `${BASE_URL}/orders/items/${orderItemId}/cancel`,
      { reason },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Cancel order item error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error cancelling order item"
    };
  }
}

export async function haggleOrderItemPrice(orderItemId, offeredPrice) {
  try {
    const response = await axios.post(
      `${BASE_URL}/orders/${orderItemId}/haggle-price`,
      { offeredPrice },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Haggle order item price error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error submitting haggle price'
    };
  }
}

export async function requestEnhancement(orderItemId, notes, preferredCompletionDate = null, addAccessories = false, photoFiles = []) {
  try {
    const token = localStorage.getItem('token');
    const files = Array.isArray(photoFiles) ? photoFiles.filter(Boolean) : [];

    if (files.length > 0) {
      const formData = new FormData();
      formData.append('notes', String(notes || ''));
      if (preferredCompletionDate) {
        formData.append('preferredCompletionDate', preferredCompletionDate);
      }
      formData.append('addAccessories', addAccessories ? 'true' : 'false');
      files.forEach((file) => {
        if (file instanceof File) {
          formData.append('photos', file);
        }
      });

      const response = await axios.post(
        `${BASE_URL}/tracking/request-enhancement/${orderItemId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data;
    }

    const response = await axios.post(
      `${BASE_URL}/tracking/request-enhancement/${orderItemId}`,
      { notes, preferredCompletionDate, addAccessories },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Request enhancement error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error requesting enhancement"
    };
  }
}

export async function confirmRentalSecurityFeeReceipt(orderItemId) {
  try {
    const response = await axios.post(
      `${BASE_URL}/orders/rental/items/${orderItemId}/confirm-deposit-receipt`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Confirm rental security fee receipt error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Error confirming security fee receipt'
    };
  }
}
