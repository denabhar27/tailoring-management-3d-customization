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

export async function recordPayment(itemId, paymentAmount) {
    try {
        const response = await axios.post(`${BASE_URL}/orders/items/${itemId}/payment`, {
            paymentAmount: paymentAmount
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Record payment error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error recording payment"
        };
    }
}

