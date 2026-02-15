import { API_URL } from './config';

const API_URL_ORDERS = `${API_URL}/orders`;

const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const getAllDryCleaningOrders = async () => {
    try {
        const response = await fetch(`${API_URL_ORDERS}/dry-cleaning/orders`, {
            headers: getAuthHeader()
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching dry cleaning orders:', error);
        return { success: false, message: 'Network error' };
    }
};

export const getDryCleaningOrdersByStatus = async (status) => {
    try {
        const response = await fetch(`${API_URL_ORDERS}/dry-cleaning/orders/status/${status}`, {
            headers: getAuthHeader()
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching dry cleaning orders with status ${status}:`, error);
        return { success: false, message: 'Network error' };
    }
};

export const updateDryCleaningOrderItem = async (itemId, updateData) => {
    try {
        const response = await fetch(`${API_URL_ORDERS}/dry-cleaning/items/${itemId}`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify(updateData)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error updating dry cleaning order item ${itemId}:`, error);
        return { success: false, message: 'Network error' };
    }
};
