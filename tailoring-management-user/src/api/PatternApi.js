import axios from "axios";
import { API_URL, API_BASE_URL } from './config';

const BASE_URL = API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export async function getAllPatterns() {
  try {
    const response = await axios.get(`${BASE_URL}/patterns`);
    return response.data;
  } catch (error) {
    console.error("Get all patterns error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching patterns",
      patterns: []
    };
  }
}

export async function getPatternsByType(type) {
  try {
    const response = await axios.get(`${BASE_URL}/patterns/type/${type}`);
    return response.data;
  } catch (error) {
    console.error("Get patterns by type error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching patterns",
      patterns: []
    };
  }
}

export async function getPatternByCode(code) {
  try {
    const response = await axios.get(`${BASE_URL}/patterns/code/${code}`);
    return response.data;
  } catch (error) {
    console.error("Get pattern by code error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching pattern",
      pattern: null
    };
  }
}

export async function getPatternById(patternId) {
  try {
    const response = await axios.get(`${BASE_URL}/patterns/${patternId}`);
    return response.data;
  } catch (error) {
    console.error("Get pattern by ID error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error fetching pattern",
      pattern: null
    };
  }
}

export async function createPattern(patternData) {
  try {
    const response = await axios.post(`${BASE_URL}/patterns`, patternData, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Create pattern error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error creating pattern"
    };
  }
}

export async function uploadPatternImage(file, patternData) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found in localStorage');
      return {
        success: false,
        message: 'Authentication required. Please log in again.'
      };
    }

    console.log('Uploading pattern image:', {
      fileName: file.name,
      fileSize: file.size,
      patternName: patternData.pattern_name,
      makeSeamless: patternData.make_seamless,
      textureSize: patternData.texture_size,
      hasToken: !!token
    });

    const formData = new FormData();
    formData.append('patternImage', file);
    formData.append('pattern_code', patternData.pattern_code);
    formData.append('pattern_name', patternData.pattern_name);
    if (patternData.repeat_x) formData.append('repeat_x', patternData.repeat_x);
    if (patternData.repeat_y) formData.append('repeat_y', patternData.repeat_y);
    if (patternData.is_seamless !== undefined) formData.append('is_seamless', patternData.is_seamless);
    if (patternData.description) formData.append('description', patternData.description);
    if (patternData.sort_order) formData.append('sort_order', patternData.sort_order);

    if (patternData.make_seamless !== undefined) formData.append('make_seamless', patternData.make_seamless);
    if (patternData.texture_size) formData.append('texture_size', patternData.texture_size);
    if (patternData.pattern_scale) formData.append('pattern_scale', patternData.pattern_scale);

    const response = await axios.post(`${BASE_URL}/patterns/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`
        
      },
      timeout: 120000 
    });
    return response.data;
  } catch (error) {
    console.error("Upload pattern image error:", error);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.response?.status);
    
    if (error.response?.status === 401) {
      return {
        success: false,
        message: 'Authentication failed. Please log in again.',
        requiresAuth: true
      };
    }
    
    return {
      success: false,
      message: error.response?.data?.message || error.message || "Error uploading pattern image"
    };
  }
}

export async function updatePattern(patternId, updateData, file = null) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return {
        success: false,
        message: 'Authentication required. Please log in again.'
      };
    }

    let response;
    
    if (file) {
      
      const formData = new FormData();
      formData.append('patternImage', file);
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          formData.append(key, updateData[key]);
        }
      });
      
      response = await axios.put(`${BASE_URL}/patterns/${patternId}`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 60000
      });
    } else {
      
      response = await axios.put(`${BASE_URL}/patterns/${patternId}`, updateData, {
        headers: getAuthHeaders()
      });
    }
    
    return response.data;
  } catch (error) {
    console.error("Update pattern error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error updating pattern"
    };
  }
}

export async function deletePattern(patternId) {
  try {
    const response = await axios.delete(`${BASE_URL}/patterns/${patternId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Delete pattern error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error deleting pattern"
    };
  }
}

export async function restorePattern(patternId) {
  try {
    const response = await axios.post(`${BASE_URL}/patterns/${patternId}/restore`, {}, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error("Restore pattern error:", error);
    return {
      success: false,
      message: error.response?.data?.message || "Error restoring pattern"
    };
  }
}

export function getPatternImageUrl(pattern) {
  if (!pattern || !pattern.image_url) return null;
  
  if (pattern.image_url.startsWith('http')) {
    return pattern.image_url;
  }

  return `${API_BASE_URL}${pattern.image_url.startsWith('/') ? '' : '/'}${pattern.image_url}`;
}
