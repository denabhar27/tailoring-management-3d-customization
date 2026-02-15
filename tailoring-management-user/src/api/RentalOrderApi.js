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

export async function getAllRentalOrders() {
    try {
        const response = await axios.get(`${BASE_URL}/orders/rental/orders`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get rental orders error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error fetching rental orders",
            orders: []
        };
    }
}

export async function getRentalOrdersByStatus(status) {
    try {
        const response = await axios.get(`${BASE_URL}/orders/rental/orders/status/${status}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get rental orders by status error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error fetching rental orders by status",
            orders: []
        };
    }
}

export async function updateRentalOrderItem(itemId, updateData) {
    try {
        const response = await axios.put(`${BASE_URL}/orders/rental/items/${itemId}`, updateData, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Update rental order item error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error updating rental order item"
        };
    }
}

export async function recordRentalPayment(itemId, paymentAmount) {
    try {
        const response = await axios.post(`${BASE_URL}/orders/rental/items/${itemId}/payment`, {
            paymentAmount: paymentAmount
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Record rental payment error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error recording payment"
        };
    }
}

export async function getActiveRentalsWithPenalty() {
    try {
        const response = await axios.get(`${BASE_URL}/rentals/monitoring/active`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get active rentals error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error fetching active rentals",
            data: []
        };
    }
}

export async function getRentalPenalty(itemId) {
    try {
        const response = await axios.get(`${BASE_URL}/rentals/monitoring/penalty/${itemId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get rental penalty error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error calculating penalty",
            data: null
        };
    }
}

export async function triggerRentalCheck() {
    try {
        const response = await axios.post(`${BASE_URL}/rentals/monitoring/check`, {}, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Trigger rental check error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error running rental check"
        };
    }
}

export async function getSchedulerStatus() {
    try {
        const response = await axios.get(`${BASE_URL}/rentals/monitoring/status`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get scheduler status error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error fetching scheduler status",
            data: null
        };
    }
}