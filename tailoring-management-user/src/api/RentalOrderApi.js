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

export async function recordRentalPayment(itemId, paymentAmount, cashReceived = paymentAmount, paymentMethod = 'cash', paymentKind = 'regular') {
    try {
        const response = await axios.post(`${BASE_URL}/orders/rental/items/${itemId}/payment`, {
            paymentAmount: paymentAmount,
            cashReceived: cashReceived,
            paymentMethod: paymentMethod,
            paymentKind: paymentKind
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

export async function recordRentalSecurityFeeReturn(itemId, refundAmount, damagedSizes = []) {
    try {
        const response = await axios.post(`${BASE_URL}/orders/rental/items/${itemId}/deposit-return`, {
            refundAmount,
            damagedSizes
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Record rental security fee return error:", error);
        return {
            success: false,
            message: error.response?.data?.message || "Error recording security fee return"
        };
    }
}

const toDateOnly = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
};

export function getRentalOrderSelectedSizes(rentalOrder) {
    const specificData = rentalOrder?.specific_data || {};
    if (specificData?.is_bundle && Array.isArray(specificData.bundle_items)) {
        return specificData.bundle_items.flatMap((bundleItem) => bundleItem.selected_sizes || bundleItem.selectedSizes || []);
    }
    return specificData?.selected_sizes || specificData?.selectedSizes || [];
}

export function getRentalOrderDueDate(rentalOrder, selectedSize = null) {
    if (selectedSize && toDateOnly(selectedSize.due_date)) {
        return toDateOnly(selectedSize.due_date);
    }

    const pricingFactors = rentalOrder?.pricing_factors || {};
    return (
        toDateOnly(rentalOrder?.due_date)
        || toDateOnly(pricingFactors?.due_date)
        || toDateOnly(rentalOrder?.rental_end_date)
        || null
    );
}

export function calculateOverdueAmount(rentalOrder, selectedSize = null, asOfDate = new Date()) {
    const dueDate = getRentalOrderDueDate(rentalOrder, selectedSize);
    if (!dueDate) {
        return { dueDate: null, daysOverdue: 0, overdueRate: 0, overdueAmount: 0 };
    }

    const pricingFactors = rentalOrder?.pricing_factors || {};
    const overdueRate = parseFloat(
        selectedSize?.overdue_amount
        ?? selectedSize?.overdue_rate
        ?? rentalOrder?.overdue_rate
        ?? pricingFactors?.overdue_rate
        ?? 50
    ) || 0;

    const due = new Date(`${dueDate}T00:00:00`);
    const today = new Date(asOfDate);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = Math.max(0, diffDays);
    const overdueAmount = daysOverdue * Math.max(0, overdueRate);

    return {
        dueDate,
        daysOverdue,
        overdueRate: Math.max(0, overdueRate),
        overdueAmount
    };
}