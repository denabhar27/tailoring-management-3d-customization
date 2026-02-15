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

export async function getAllBillingRecords() {
    try {
        const response = await axios.get(`${BASE_URL}/billing/records`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get billing records error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error fetching billing records",
            records: []
        };
    }
}

export async function getBillingRecordsByStatus(status) {
    try {
        const response = await axios.get(`${BASE_URL}/billing/records/status/${status}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get billing records by status error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error fetching billing records by status",
            records: []
        };
    }
}

export async function updateBillingRecordStatus(recordId, status) {
    try {
        const response = await axios.put(`${BASE_URL}/billing/records/${recordId}/status`, 
            { status },
            {
                headers: getAuthHeaders()
            }
        );
        return response.data;
    } catch (error) {
        console.error("Update billing record status error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error updating billing record status"
        };
    }
}

export async function getBillingStats() {
    try {
        const response = await axios.get(`${BASE_URL}/billing/stats`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Get billing stats error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error fetching billing statistics",
            stats: {
                total: 0,
                paid: 0,
                unpaid: 0,
                totalRevenue: 0,
                pendingRevenue: 0
            }
        };
    }
}