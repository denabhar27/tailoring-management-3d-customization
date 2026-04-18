import { API_URL } from './config';

const API_URL_DAMAGE = `${API_URL}/damage-records`;

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
};

export const createCompensationIncident = async (payload) => {
  try {
    const hasImage = payload?.disputeImageFile instanceof File;
    let requestBody;
    let requestHeaders;

    if (hasImage) {
      const formData = new FormData();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (key === 'disputeImageFile' || value === undefined || value === null) return;
        formData.append(key, value);
      });
      formData.append('disputeImage', payload.disputeImageFile);
      const token = localStorage.getItem('token');
      requestHeaders = { Authorization: `Bearer ${token}` };
      requestBody = formData;
    } else {
      requestHeaders = getAuthHeader();
      requestBody = JSON.stringify(payload);
    }

    const response = await fetch(`${API_URL_DAMAGE}/compensation-incidents`, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating compensation incident:', error);
    return { success: false, message: 'Network error' };
  }
};

export const updateCompensationLiability = async (incidentId, payload) => {
  try {
    const response = await fetch(`${API_URL_DAMAGE}/compensation-incidents/${incidentId}/liability`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating compensation liability:', error);
    return { success: false, message: 'Network error' };
  }
};

export const submitCustomerLiabilityDecision = async (incidentId, payload) => {
  try {
    const response = await fetch(`${API_URL_DAMAGE}/compensation-incidents/${incidentId}/customer-liability`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting customer liability decision:', error);
    return { success: false, message: 'Network error' };
  }
};

export const settleCompensationIncident = async (incidentId, payload = {}) => {
  try {
    const response = await fetch(`${API_URL_DAMAGE}/compensation-incidents/${incidentId}/settlement`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error settling compensation incident:', error);
    return { success: false, message: 'Network error' };
  }
};

export const getCompensationIncidents = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params.append(key, value);
      }
    });

    const query = params.toString();
    const response = await fetch(`${API_URL_DAMAGE}/compensation-incidents${query ? `?${query}` : ''}`, {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching compensation incidents:', error);
    return { success: false, message: 'Network error' };
  }
};

export const getCompensationStats = async () => {
  try {
    const response = await fetch(`${API_URL_DAMAGE}/compensation-stats`, {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching compensation stats:', error);
    return { success: false, message: 'Network error' };
  }
};
