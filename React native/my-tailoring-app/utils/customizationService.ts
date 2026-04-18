
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import apiCall from './apiService';
import { API_BASE_URL } from './apiService';

const REQUEST_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT || '10000', 10);

export const uploadCustomizationImage = async (formData: FormData) => {
  const token = await AsyncStorage.getItem('userToken');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}/customization/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload image');
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const addCustomizationToCart = async (customizationData: {
  garmentType: string;
  fabricType: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  imageUrl?: string;
  designData?: any;
  estimatedPrice?: number;
  isUniform?: boolean;
  garments?: Array<{
    fabricType: string;
    garmentType: string;
    imageUrl?: string;
    estimatedPrice?: number;
    isUniform?: boolean;
    designData?: any;
  }>;
  isMultipleGarments?: boolean;
}) => {

  const isUniform = customizationData.isUniform || customizationData.garmentType?.toLowerCase() === 'uniform';

  const price = isUniform ? 0 : (customizationData.estimatedPrice || 500);

  const garments = Array.isArray(customizationData.garments)
    ? customizationData.garments.filter(Boolean)
    : [];

  const cartData = {
    serviceType: 'customization',
    serviceId: null,
    quantity: garments.length > 0 ? garments.length : 1,
    basePrice: price,
    finalPrice: price,
    pricingFactors: {
      fabricType: customizationData.fabricType,
      garmentType: customizationData.garmentType,
      designComplexity: 'standard',
      preferredDate: customizationData.preferredDate,
      preferredTime: customizationData.preferredTime,
      isUniform: isUniform
    },
    specificData: {
      garmentType: customizationData.garmentType,
      fabricType: customizationData.fabricType,
      measurements: customizationData.notes || '',
      notes: customizationData.notes || '',
      preferredDate: customizationData.preferredDate || '',
      preferredTime: customizationData.preferredTime || '',
      imageUrl: customizationData.imageUrl || 'no-image',
      designData: customizationData.designData || {},
      garments,
      isMultipleGarments: customizationData.isMultipleGarments || garments.length > 1,
      isUniform: isUniform,
      uploadedAt: new Date().toISOString()
    },
    rentalDates: null
  };

  return apiCall('/cart', {
    method: 'POST',
    body: JSON.stringify(cartData),
  });
};

export const getUserCustomizationOrders = async () => {
  return apiCall('/customization/user', {
    method: 'GET',
  });
};

export const getAllCustomizationOrders = async () => {
  return apiCall('/customization', {
    method: 'GET',
  });
};

export const getCustomizationOrderById = async (itemId: number) => {
  return apiCall(`/customization/${itemId}`, {
    method: 'GET',
  });
};

export const updateCustomizationOrderItem = async (
  itemId: number,
  updateData: {
    finalPrice?: number;
    approvalStatus?: string;
    adminNotes?: string;
  }
) => {
  return apiCall(`/customization/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
};

export const editOrderPrice = async (
  itemId: number,
  finalPrice: number,
  adminNotes: string
) => {
  return apiCall(`/customization/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ finalPrice, adminNotes }),
  });
};

export const getCustomizationStats = async () => {
  return apiCall('/customization/stats', {
    method: 'GET',
  });
};

export const convertBase64ToFormData = async (
  base64Image: string,
  filename: string = 'design.png'
): Promise<{ formData: FormData; fileUri: string }> => {
  if (!base64Image) {
    throw new Error('Base64 image data is required');
  }

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  if (!base64Data) {
    throw new Error('Invalid base64 image data');
  }

  let imageType = 'image/png';
  if (base64Image.includes('data:image/jpeg') || base64Image.includes('data:image/jpg')) {
    imageType = 'image/jpeg';
  } else if (base64Image.includes('data:image/png')) {
    imageType = 'image/png';
  } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    imageType = 'image/jpeg';
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('FileSystem cache directory is not available');
  }

  const timestamp = Date.now();
  const uniqueFilename = `${timestamp}-${filename}`;
  let fileUri = `${FileSystem.cacheDirectory}${uniqueFilename}`;

  try {
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (writeError: any) {
    console.error('Error writing base64 to file:', writeError);
    throw new Error(`Failed to save image to temporary file: ${writeError?.message || writeError}`);
  }

  const formDataUri = Platform.OS === 'android' ? `file://${fileUri}` : fileUri;

  const formData = new FormData();
  formData.append('customizationImage', {
    uri: formDataUri,
    type: imageType,
    name: filename,
  } as any);

  return { formData, fileUri };
};
