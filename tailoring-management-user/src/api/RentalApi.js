import axios from "axios";

import { API_URL } from './config';



const BASE_URL = API_URL;



const getAuthHeaders = () => {

  const token = localStorage.getItem('token');

  return {

    'Authorization': token ? `Bearer ${token}` : '',

    'Content-Type': 'application/json'

  };

};



export async function getAllRentals() {

  try {

    const response = await axios.get(`${BASE_URL}/rentals`, {

      headers: getAuthHeaders()

    });

    return response.data;

  } catch (error) {

    console.error("Get all rentals error:", error);

    return {

      message: error.response?.data?.message || "Error fetching rentals",

      items: []

    };

  }

}



export async function getAvailableRentals() {

  try {

    const response = await axios.get(`${BASE_URL}/rentals/available`, {

      headers: getAuthHeaders()

    });

    return response.data;

  } catch (error) {

    console.error("Get available rentals error:", error);

    return {

      message: error.response?.data?.message || "Error fetching available rentals",

      items: []

    };

  }

}



export async function getRentalById(item_id) {

  try {

    const response = await axios.get(`${BASE_URL}/rentals/${item_id}`);

    return response.data;

  } catch (error) {

    console.error("Get rental by ID error:", error);

    return {

      message: error.response?.data?.message || "Error fetching rental item",

      item: null

    };

  }

}



export async function createRental(rentalData, imageFiles) {

  try {

    const formData = new FormData();



    Object.keys(rentalData).forEach(key => {

      if (rentalData[key] !== null && rentalData[key] !== undefined) {

        formData.append(key, rentalData[key]);

      }

    });



    if (imageFiles && typeof imageFiles === 'object' && !imageFiles.name) {



      if (imageFiles.front_image) {

        formData.append('front_image', imageFiles.front_image);

      }

      if (imageFiles.back_image) {

        formData.append('back_image', imageFiles.back_image);

      }

      if (imageFiles.side_image) {

        formData.append('side_image', imageFiles.side_image);

      }

    } else if (imageFiles && imageFiles.name) {



      formData.append('image', imageFiles);

    }



    const response = await axios.post(`${BASE_URL}/rentals`, formData, {

      headers: {

        'Content-Type': 'multipart/form-data',

      },

    });



    return response.data;

  } catch (error) {

    console.error("Create rental error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error creating rental item"

    };

  }

}



export async function updateRental(item_id, rentalData, imageFiles) {

  try {

    const formData = new FormData();



    Object.keys(rentalData).forEach(key => {

      if (rentalData[key] !== null && rentalData[key] !== undefined) {

        formData.append(key, rentalData[key]);

      }

    });



    if (imageFiles && typeof imageFiles === 'object' && !imageFiles.name) {



      if (imageFiles.front_image) {

        formData.append('front_image', imageFiles.front_image);

      }

      if (imageFiles.back_image) {

        formData.append('back_image', imageFiles.back_image);

      }

      if (imageFiles.side_image) {

        formData.append('side_image', imageFiles.side_image);

      }

    } else if (imageFiles && imageFiles.name) {



      formData.append('image', imageFiles);

    }



    const response = await axios.put(`${BASE_URL}/rentals/${item_id}`, formData, {

      headers: {

        'Content-Type': 'multipart/form-data',

      },

    });



    return response.data;

  } catch (error) {

    console.error("Update rental error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error updating rental item"

    };

  }

}



export async function updateRentalStatus(item_id, status, damage_notes = null, damaged_by = null) {

  try {

    const payload = { status };

    if (damage_notes !== null) {

      payload.damage_notes = damage_notes;

    }

    if (damaged_by !== null) {

      payload.damaged_by = damaged_by;

    }

    const response = await axios.put(`${BASE_URL}/rentals/${item_id}/status`, payload);

    return response.data;

  } catch (error) {

    console.error("Update rental status error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error updating rental status"

    };

  }

}



export async function markRentalItemDamaged(item_id, payload) {

  try {

    const response = await axios.post(`${BASE_URL}/rentals/${item_id}/mark-damaged`, payload, {

      headers: getAuthHeaders()

    });

    return response.data;

  } catch (error) {

    console.error("Mark rental item damaged error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error marking item as damaged"

    };

  }

}



export async function resolveMaintenance(item_id, log_id, quantity, resolution_note = '') {

  try {

    const response = await axios.post(

      `${BASE_URL}/rentals/${item_id}/resolve-maintenance/${log_id}`,

      { quantity, resolution_note },

      { headers: getAuthHeaders() }

    );

    return response.data;

  } catch (error) {

    console.error("Resolve maintenance error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error resolving maintenance"

    };

  }

}



export async function getRentalSizeActivity(item_id, size_key) {

  try {

    const response = await axios.get(`${BASE_URL}/rentals/${item_id}/size-activity/${encodeURIComponent(size_key)}`, {

      headers: getAuthHeaders()

    });

    return response.data;

  } catch (error) {

    console.error("Get rental size activity error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error fetching size activity",

      data: { activities: [] }

    };

  }

}



export async function restockReturnedRentalSizes(item_id, selected_sizes = []) {

  try {

    const response = await axios.post(`${BASE_URL}/rentals/${item_id}/restock-sizes`, { selected_sizes }, {

      headers: getAuthHeaders()

    });

    return response.data;

  } catch (error) {

    console.error("Restock returned rental sizes error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error restocking returned rental sizes"

    };

  }

}



export async function deleteRental(item_id) {

  try {

    const response = await axios.delete(`${BASE_URL}/rentals/${item_id}`);

    return response.data;

  } catch (error) {

    console.error("Delete rental error:", error);

    return {

      success: false,

      message: error.response?.data?.message || "Error deleting rental item"

    };

  }

}



export async function searchRentals(searchTerm) {

  try {

    const response = await axios.get(`${BASE_URL}/rentals/search?q=${encodeURIComponent(searchTerm)}`);

    return response.data;

  } catch (error) {

    console.error("Search rentals error:", error);

    return {

      message: error.response?.data?.message || "Error searching rentals",

      items: []

    };

  }

}



export async function getRentalsByCategory(category) {

  try {

    const response = await axios.get(`${BASE_URL}/rentals/category/${encodeURIComponent(category)}`);

    return response.data;

  } catch (error) {

    console.error("Get rentals by category error:", error);

    return {

      message: error.response?.data?.message || "Error fetching rentals by category",

      items: []

    };

  }

}



export async function getRentalCategories() {

  try {

    const response = await axios.get(`${BASE_URL}/rentals/categories`);

    return response.data;

  } catch (error) {

    console.error("Get rental categories error:", error);

    return {

      message: error.response?.data?.message || "Error fetching rental categories",

      categories: []

    };

  }

}



export function getRentalImageUrl(imageUrl) {

  if (!imageUrl) return null;

  if (imageUrl.startsWith('http')) return imageUrl;



  const cleanUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;

  return `${BASE_URL.replace('/api', '')}${cleanUrl}`;

}

