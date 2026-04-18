
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter , useFocusEffect } from "expo-router";

import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import apiCall, { cartService, API_BASE_URL, appointmentSlotService } from "../../../utils/apiService";
import { filterUserAllowedSlots } from '../../../utils/appointmentSlotFilters';

import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get("window");

const DEFAULT_GARMENT_TYPES: { [key: string]: number } = {
  "Shirt": 100,
  "Pants": 120,
  "Dress": 180,
  "Suit (2-piece)": 350,
  "Suit (3-piece)": 450,
  "Blazer/Jacket": 200,
  "Coat": 250,
  "Gown": 400,
  "Wedding Dress": 800,
  "Barong Tagalog": 300,
  "Skirt": 100,
  "Blouse": 90,
  "Sweater": 150,
  "Tie": 50,
  "Scarf": 80,
};

interface TimeSlot {
  slot_id: number;
  time_slot: string;
  display_time: string;
  capacity: number;
  booked: number;
  available: number;
  status: 'available' | 'limited' | 'full' | 'inactive';
  statusLabel: string;
  isClickable: boolean;
}

interface GarmentItem {
  id: number;
  garmentType: string;
  customGarmentType: string;
  brand: string;
  quantity: string;
}

export default function DryCleaningClothes() {

  console.log('🧹🧹🧹 DRYCLEANING COMPONENT RENDERING 🧹🧹🧹');

  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [garments, setGarments] = useState<GarmentItem[]>([
    { id: 1, garmentType: '', customGarmentType: '', brand: '', quantity: '1' }
  ]);

  const [specialInstructions, setSpecialInstructions] = useState("");
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [garmentPrices, setGarmentPrices] = useState<{ [key: string]: number }>(DEFAULT_GARMENT_TYPES);
  const [loadingGarments, setLoadingGarments] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);

  const addGarment = () => {
    const newId = Math.max(...garments.map(g => g.id)) + 1;
    setGarments([...garments, { id: newId, garmentType: '', customGarmentType: '', brand: '', quantity: '1' }]);
  };

  const removeGarment = (id: number) => {
    if (garments.length > 1) {
      setGarments(garments.filter(g => g.id !== id));
    }
  };

  const updateGarment = (id: number, field: keyof GarmentItem, value: string) => {
    console.log(`[DryCleaning] updateGarment called - id: ${id}, field: ${field}, value: ${value}`);
    setGarments(prevGarments => {
      const updated = prevGarments.map(g =>
        g.id === id ? { ...g, [field]: value } : g
      );
      console.log('[DryCleaning] Updated garments:', JSON.stringify(updated, null, 2));
      return updated;
    });
  };

  const calculateTotalPrice = (): number => {
    return garments.reduce((total, garment) => {
      if (!garment.garmentType) return total;
      const price = garment.garmentType.toLowerCase() === 'others' ? 350 : (garmentPrices[garment.garmentType] || 0);
      const qty = parseInt(garment.quantity) || 1;
      return total + (price * qty);
    }, 0);
  };

  const hasOthersGarment = (): boolean => {
    return garments.some(g => g.garmentType.toLowerCase() === 'others');
  };

  useEffect(() => {
    console.log('=== [DryCleaning] Component MOUNTED - DYNAMIC VERSION ===');
    console.log('=== Loading DC garment types from API ===');
    loadDCGarmentTypes();
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('[DryCleaning] Screen focused');
      if (pickupDate) {
        loadTimeSlots(pickupDate);
      }
    }, [pickupDate])
  );

  const loadDCGarmentTypes = async () => {
    setLoadingGarments(true);
    console.log('=== [DryCleaning] loadDCGarmentTypes CALLED ===');
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('[DryCleaning] Token:', token ? 'Retrieved' : 'Missing');

      const baseUrl = API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL;
      const url = `${baseUrl}/dc-garment-types`;
      console.log('[DryCleaning] Fetching:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      console.log('[DryCleaning] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[DryCleaning] API returned', data.data?.length || 0, 'items');
        console.log('[DryCleaning] Raw API data:', JSON.stringify(data.data?.slice(0, 3), null, 2));

        if (data.success && data.data && data.data.length > 0) {
          const garmentTypesObj: { [key: string]: number } = {};
          const activeGarments = data.data.filter((g: any) => g.is_active === 1 || g.is_active === true);
          console.log('[DryCleaning] Active garments count:', activeGarments.length);
          
          activeGarments.forEach((garment: any) => {
            garmentTypesObj[garment.garment_name] = parseFloat(garment.garment_price) || 0;
            if (garment.garment_name.toLowerCase() === 'others') {
              console.log('[DryCleaning] ✅ Found "Others" garment:', garment);
            }
          });

          if (Object.keys(garmentTypesObj).length > 0) {
            setGarmentPrices(garmentTypesObj);
            console.log('✅ [DryCleaning] SUCCESS - Loaded', Object.keys(garmentTypesObj).length, 'garment types from API');
            console.log('✅ [DryCleaning] Types:', Object.keys(garmentTypesObj).join(', '));
            const hasOthers = Object.keys(garmentTypesObj).some(k => k.toLowerCase() === 'others');
            console.log('✅ [DryCleaning] "Others" in final list:', hasOthers);
          } else {
            console.log('[DryCleaning] No active garment types found, using defaults');
          }
        } else {
          console.log('[DryCleaning] API returned empty data, using defaults');
        }
      } else {
        const errorText = await response.text();
        console.log('[DryCleaning] API error:', response.status, errorText);
      }
    } catch (error: any) {
      console.log('[DryCleaning] FETCH ERROR:', error.message || error);
    } finally {
      setLoadingGarments(false);
      console.log('[DryCleaning] Loading complete');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
      setCurrentImageIndex(images.length);
    }
  };

  const removeCurrentImage = () => {
    if (images.length > 0) {
      const newImages = images.filter((_, i) => i !== currentImageIndex);
      setImages(newImages);
      if (currentImageIndex >= newImages.length && newImages.length > 0) {
        setCurrentImageIndex(newImages.length - 1);
      } else if (newImages.length === 0) {
        setCurrentImageIndex(0);
      }
    }
  };

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const handleDateConfirm = async (selectedDate: Date) => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    try {
      const checkResult = await apiCall(`/shop-schedule/check?date=${dateStr}`);

      if (!checkResult.success || !checkResult.is_open) {
        Alert.alert(
          'Shop Closed',
          'The shop is closed on this date. Please select another date.',
          [{ text: 'OK' }]
        );
        setShowDatePicker(false);
        return;
      }
    } catch (error: any) {
      console.error('Error checking date availability:', error);
      const dayOfWeek = selectedDate.getDay();
      if (dayOfWeek === 0) {
        Alert.alert(
          'Shop Closed',
          'The shop is closed on Sundays. Please select another date.',
          [{ text: 'OK' }]
        );
        setShowDatePicker(false);
        return;
      }
    }

    setPickupDate(selectedDate);
    setShowDatePicker(false);
    setSelectedTimeSlot("");
    await loadTimeSlots(selectedDate);
  };

  const loadTimeSlots = async (date: Date) => {
    setLoadingSlots(true);
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
          const result = await appointmentSlotService.getAllSlotsWithAvailability('dry_cleaning', dateStr, 5000);

      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setTimeSlots([]);
          Alert.alert('Shop Closed', 'The shop is closed on this date. Please select another date.');
          return;
        }

        setIsShopOpen(true);
            setTimeSlots(filterUserAllowedSlots(result.slots));
      } else {
        setTimeSlots([]);
        Alert.alert('Error', result.message || 'Failed to load time slots');
      }
    } catch (error: any) {
      console.error('Error loading time slots:', error);
      setTimeSlots([]);
      Alert.alert('Error', 'Failed to load time slots. Please try again.');
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (!pickupDate) return;

    const refreshInterval = setInterval(() => {
      const year = pickupDate.getFullYear();
      const month = String(pickupDate.getMonth() + 1).padStart(2, '0');
      const day = String(pickupDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      appointmentSlotService.getAllSlotsWithAvailability('dry_cleaning', dateStr, 5000)
        .then((result) => {
          if (result.success && result.slots) {
            const filteredSlots = filterUserAllowedSlots(result.slots);
            setTimeSlots((currentSlots) => {
              const currentCounts = JSON.stringify(currentSlots.map(s => ({ time: s.time_slot, available: s.available })));
              const newCounts = JSON.stringify(filteredSlots.map((s: TimeSlot) => ({ time: s.time_slot, available: s.available })));

              if (currentCounts !== newCounts) {
                if (!result.isShopOpen) {
                  setIsShopOpen(false);
                  return [];
                } else {
                  setIsShopOpen(true);
                  return filteredSlots;
                }
              }
              return currentSlots;
            });
          }
        })
        .catch((error: any) => {
          if (!error.message?.includes('timeout')) {
            console.warn('[POLLING] Error polling time slots:', error.message);
          }
        });
    }, 5000);

    return () => clearInterval(refreshInterval);
  }, [pickupDate]);

  const handlePickerCancel = () => {
    setShowDatePicker(false);
  };

  const garmentTypes = Object.keys(garmentPrices);
  console.log('[DryCleaning] Current garmentTypes for picker:', garmentTypes.length, 'items -', garmentTypes.slice(0, 5).join(', '), garmentTypes.length > 5 ? '...' : '');

  const getPriceForGarment = (garment: string): number => {
    return garmentPrices[garment] || 200;
  };

  const handleAddService = async () => {
    console.log('[DryCleaning] handleAddService called');
    console.log('[DryCleaning] Current garments state:', JSON.stringify(garments, null, 2));
    
    // Only validate garments that have a type selected
    const garmentsWithType = garments.filter(g => g.garmentType);
    console.log('[DryCleaning] Garments with type:', garmentsWithType.length);
    
    if (garmentsWithType.length === 0) {
      Alert.alert("Missing Information", "Please add at least one garment with type and quantity");
      return;
    }

    // Validate only the garments that have been started
    for (const garment of garmentsWithType) {
      if (garment.garmentType.toLowerCase() === 'others' && !garment.customGarmentType.trim()) {
        Alert.alert("Missing Information", "Please specify the garment type for 'Others' items");
        return;
      }
      const qty = parseInt(garment.quantity);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert("Invalid Quantity", "Please enter a valid quantity for all items");
        return;
      }
    }

    if (!pickupDate) {
      Alert.alert("Missing Information", "Please select a pickup date");
      return;
    }

    if (!selectedTimeSlot) {
      Alert.alert("Missing Information", "Please select a time slot");
      return;
    }

    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      Alert.alert(
        "Authentication Required",
        "Please log in to add items to your cart."
      );
      router.push("/login");
      return;
    }

    const totalPrice = calculateTotalPrice();
    const totalQuantity = garments.reduce((sum, g) => sum + (parseInt(g.quantity) || 0), 0);

    try {

      const year = pickupDate!.getFullYear();
      const month = String(pickupDate!.getMonth() + 1).padStart(2, '0');
      const day = String(pickupDate!.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const slotResult = await appointmentSlotService.bookSlot('dry_cleaning', dateStr, selectedTimeSlot);
      if (!slotResult || !slotResult.success) {
        const errorMsg = slotResult?.message || 'Failed to book appointment slot. This time may already be taken.';
        console.error('Slot booking failed:', slotResult);
        Alert.alert('Slot Unavailable', errorMsg);
        return;
      }
      console.log('Slot booked successfully:', slotResult);

      let imageUrls: string[] = [];
      if (images.length > 0) {
        for (const img of images) {
          try {
            const formData = new FormData();
            formData.append('dryCleaningImage', {
              uri: img,
              type: 'image/jpeg',
              name: `dryclean-image-${Date.now()}.jpg`,
            } as any);

            const uploadToken = await AsyncStorage.getItem('userToken');
            const uploadResponse = await fetch(`${API_BASE_URL}/dry-cleaning/upload-image`, {
              method: 'POST',
              headers: {
                'Authorization': uploadToken ? `Bearer ${uploadToken}` : '',
              },
              body: formData,
            });

            const uploadResult = await uploadResponse.json();

            if (uploadResult.success) {
              const url = uploadResult.data.url || uploadResult.data.filename || '';
              imageUrls.push(url);
              console.log('Image uploaded successfully, URL:', url);
            } else {
              console.warn('Image upload failed:', uploadResult.message);
            }
          } catch (uploadError) {
            console.error('Image upload failed:', uploadError);
          }
        }
        if (imageUrls.length === 0 && images.length > 0) {
          Alert.alert('Warning', 'Image uploads failed. Continuing without images.');
        }
      }

      const pickupDateTime = `${dateStr}T${selectedTimeSlot}`;

      const garmentsData = garments
        .filter(g => g.garmentType) // Only include garments with a type selected
        .map(garment => ({
          garmentType: garment.garmentType.toLowerCase() === 'others' && garment.customGarmentType.trim()
            ? `Others (${garment.customGarmentType.trim()})`
            : garment.garmentType,
          brand: garment.brand,
          quantity: parseInt(garment.quantity) || 1,
          pricePerItem: garment.garmentType.toLowerCase() === 'others' ? 350 : getPriceForGarment(garment.garmentType),
          isEstimated: garment.garmentType.toLowerCase() === 'others'
        }));

      const dryCleaningData = {
        serviceType: 'dry_cleaning',
        serviceId: 3,
        serviceName: 'Dry Cleaning Service',
        basePrice: '0',
        finalPrice: totalPrice.toString(),
        quantity: totalQuantity,
        specificData: {
          garments: garmentsData,
          isMultipleGarments: garments.length > 1,
          notes: specialInstructions,
          imageUrl: imageUrls.length > 0 ? imageUrls[0] : 'no-image',
          imageUrls: imageUrls.length > 0 ? imageUrls : [],
          pickupDate: pickupDateTime,
          appointmentTime: selectedTimeSlot
        }
      };

      const result = await cartService.addToCart(dryCleaningData);

      if (result.success) {

        if (pickupDate) {
          loadTimeSlots(pickupDate);
        }

        Alert.alert("Success!", "Dry cleaning service added to cart!", [
          {
            text: "View Cart",
            onPress: () => router.push("/cart/Cart"),
          },
          {
            text: "Add More",
            onPress: () => {
              setGarments([{ id: 1, garmentType: '', customGarmentType: '', brand: '', quantity: '1' }]);
              setSpecialInstructions("");
              setImages([]);
              setCurrentImageIndex(0);
              setPickupDate(null);
              setSelectedTimeSlot("");
              setTimeSlots([]);
            },
          },
        ]);
      } else {
        throw new Error(result.message || "Failed to add dry cleaning service to cart");
      }
    } catch (error: any) {
      console.error("Add service error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to add dry cleaning service. Please try again."
      );
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#5D4037" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🧼 Dry Cleaning Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
          {/* Image Upload Section */}
          <View style={styles.imageSection}>
            {images.length > 0 ? (
              <View style={styles.imageCarousel}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: images[currentImageIndex] }} style={styles.previewImage} />
                  {images.length > 1 && (
                    <>
                      <TouchableOpacity 
                        style={[styles.imageNavButton, styles.imageNavLeft, currentImageIndex === 0 && styles.imageNavDisabled]} 
                        onPress={goToPreviousImage}
                        disabled={currentImageIndex === 0}
                      >
                        <Ionicons name="chevron-back" size={24} color={currentImageIndex === 0 ? "#ccc" : "#5D4037"} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.imageNavButton, styles.imageNavRight, currentImageIndex === images.length - 1 && styles.imageNavDisabled]} 
                        onPress={goToNextImage}
                        disabled={currentImageIndex === images.length - 1}
                      >
                        <Ionicons name="chevron-forward" size={24} color={currentImageIndex === images.length - 1 ? "#ccc" : "#5D4037"} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={styles.removeImageButton} onPress={removeCurrentImage}>
                    <Ionicons name="close-circle" size={28} color="#ef5350" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.imageCounter}>{currentImageIndex + 1} / {images.length}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                <View style={styles.uploadContent}>
                  <View style={styles.uploadIconCircle}>
                    <Ionicons name="camera-outline" size={36} color="#8D6E63" />
                  </View>
                  <Text style={styles.uploadText}>
                    Tap to upload photo of garment
                  </Text>
                  <Text style={styles.uploadSubtext}>
                    Clear image helps us serve you better
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {images.length > 0 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                <Ionicons name="add-circle-outline" size={20} color="#5D4037" />
                <Text style={styles.addImageText}>Add Another Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Garments - Simple repeated inputs */}
          {garments.map((garment, index) => (
            <View key={garment.id}>
              {index > 0 && <View style={styles.garmentDivider} />}

              {garments.length > 1 && (
                <View style={styles.garmentRowHeader}>
                  <Text style={styles.garmentLabel}>Garment #{index + 1}</Text>
                  <TouchableOpacity
                    style={styles.removeGarmentButton}
                    onPress={() => removeGarment(garment.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef5350" />
                    <Text style={styles.removeGarmentText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Garment Type *</Text>
                {loadingGarments ? (
                  <View style={[styles.pickerWrapper, { justifyContent: 'center', alignItems: 'center', paddingVertical: 15 }]}>
                    <ActivityIndicator size="small" color="#8D6E63" />
                  </View>
                ) : (
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={garment.garmentType || ""}
                      onValueChange={(itemValue, itemIndex) => {
                        console.log('[DryCleaning] Picker onValueChange - value:', itemValue, 'index:', itemIndex);
                        if (itemValue && itemValue !== garment.garmentType) {
                          updateGarment(garment.id, 'garmentType', itemValue);
                          if (itemValue.toLowerCase() !== 'others') {
                            updateGarment(garment.id, 'customGarmentType', '');
                          }
                        }
                      }}
                      style={styles.picker}
                      dropdownIconColor="#8D6E63"
                      mode="dropdown"
                    >
                      <Picker.Item label="Select garment type..." value="" color="#999" />
                      {garmentTypes.map((item, idx) => {
                        const price = getPriceForGarment(item);
                        const isOthers = item.toLowerCase() === 'others';
                        const label = isOthers ? `${item} - ₱0 (Price TBD)` : `${item} - ₱${price}`;
                        return (
                          <Picker.Item
                            label={label}
                            value={item}
                            key={`${garment.id}-${item}-${idx}`}
                          />
                        );
                      })}
                    </Picker>
                  </View>
                )}
              </View>

              {garment.garmentType.toLowerCase() === 'others' && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Specify Garment Type *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Curtains, Pillow, Blanket, etc."
                    placeholderTextColor="#94a3b8"
                    value={garment.customGarmentType}
                    onChangeText={(value) => updateGarment(garment.id, 'customGarmentType', value)}
                  />
                  <Text style={styles.helperText}>Please specify what type of garment this is</Text>
                </View>
              )}

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Brand</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter brand name"
                  placeholderTextColor="#94a3b8"
                  value={garment.brand}
                  onChangeText={(value) => updateGarment(garment.id, 'brand', value)}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Quantity *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={garment.quantity}
                  onChangeText={(value) => updateGarment(garment.id, 'quantity', value)}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addGarmentButton} onPress={addGarment}>
            <Ionicons name="add-circle-outline" size={20} color="#8D6E63" />
            <Text style={styles.addGarmentButtonText}>Add Another Garment</Text>
          </TouchableOpacity>

          {garments.some(g => g.garmentType && g.quantity) && (
            <View style={styles.totalPriceContainer}>
              <Text style={styles.priceBreakdownTitle}>{hasOthersGarment() ? 'Estimated Price' : 'Final Price'}</Text>
              
              <View style={styles.priceBreakdownList}>
                {garments.filter(g => g.garmentType).map((garment) => {
                  const price = garment.garmentType.toLowerCase() === 'others' ? 350 : getPriceForGarment(garment.garmentType);
                  const qty = parseInt(garment.quantity) || 1;
                  const garmentName = garment.garmentType.toLowerCase() === 'others' 
                    ? (garment.customGarmentType || 'Custom')
                    : garment.garmentType;
                  const isOthers = garment.garmentType.toLowerCase() === 'others';
                  
                  return (
                    <Text key={garment.id} style={styles.priceBreakdownItem}>
                      {garmentName}: {qty} × ₱{price} = ₱{price * qty}{isOthers ? ' (estimated)' : ''}
                    </Text>
                  );
                })}
              </View>

              <View style={styles.totalPriceRow}>
                <Text style={styles.totalPriceLabel}>Total:</Text>
                <Text style={styles.totalPriceValue}>
                  ₱{calculateTotalPrice()}{hasOthersGarment() ? ' (Estimated)' : ''}
                </Text>
              </View>

              {hasOthersGarment() && (
                <View style={styles.estimatedNotice}>
                  <Ionicons name="information-circle" size={16} color="#ff9800" />
                  <Text style={styles.estimatedNoticeText}>
                    Final price will be confirmed by admin for "Others" items
                  </Text>
                </View>
              )}

              <Text style={styles.pickupDateText}>
                Drop off item date: {pickupDate && selectedTimeSlot 
                  ? `${pickupDate.toLocaleDateString()} ${selectedTimeSlot.substring(0, 5)}`
                  : 'Not set'}
              </Text>
            </View>
          )}

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Special Instructions (Optional)</Text>
            <TextInput
              placeholder="Any special care instructions..."
              style={styles.textArea}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={5}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Preferred Pickup Date *</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={22} color="#B8860B" />
              <Text style={styles.dateTimeText}>
                {pickupDate
                  ? pickupDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Tap to select date"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <DateTimePickerModal
              visible={showDatePicker}
              mode="date"
              value={pickupDate || new Date()}
              minimumDate={new Date()}
              onConfirm={handleDateConfirm}
              onCancel={handlePickerCancel}
            />
          </View>
          {pickupDate && (
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Select Time Slot *</Text>
              <View style={styles.timeSlotLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendDotAvailable]} />
                  <Text style={styles.legendText}>Available</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendDotLimited]} />
                  <Text style={styles.legendText}>Limited</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendDotFull]} />
                  <Text style={styles.legendText}>Full</Text>
                </View>
              </View>

              {loadingSlots ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#8D6E63" />
                  <Text style={styles.loadingText}>Loading time slots...</Text>
                </View>
              ) : !isShopOpen ? (
                <View style={styles.shopClosedContainer}>
                  <Ionicons name="close-circle" size={40} color="#ef4444" />
                  <Text style={styles.shopClosedText}>Shop is closed on this date</Text>
                </View>
              ) : timeSlots.length === 0 ? (
                <View style={styles.noSlotsContainer}>
                  <Ionicons name="time-outline" size={40} color="#8D6E63" />
                  <Text style={styles.noSlotsText}>No time slots available for this date</Text>
                </View>
              ) : (
                <View style={styles.timeSlotsGrid}>
                  {timeSlots.map((slot) => {
                    const isSelected = selectedTimeSlot === slot.time_slot;
                    const isDisabled = !slot.isClickable;

                    let buttonStyle = styles.timeSlotButtonAvailable;
                    if (slot.status === 'limited') buttonStyle = styles.timeSlotButtonLimited;
                    if (slot.status === 'full') buttonStyle = styles.timeSlotButtonFull;
                    if (slot.status === 'inactive') buttonStyle = styles.timeSlotButtonInactive;
                    if (isSelected) buttonStyle = styles.timeSlotButtonSelected;

                    return (
                      <TouchableOpacity
                        key={slot.slot_id}
                        style={[
                          styles.timeSlotButton,
                          buttonStyle,
                          isDisabled && styles.timeSlotButtonDisabled,
                        ]}
                        onPress={() => !isDisabled && setSelectedTimeSlot(slot.time_slot)}
                        disabled={isDisabled}
                      >
                        <Text style={[
                          styles.slotTime,
                          isSelected && { color: '#fff' },
                          isDisabled && { color: '#999' },
                        ]}>
                          {slot.display_time}
                        </Text>
                        <Text style={[
                          styles.slotStatus,
                          isSelected && { color: '#fff' },
                          isDisabled && { color: '#999' },
                        ]}>
                          {slot.statusLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelBtn]}
              onPress={() => router.push("./appointmentSelection")}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitBtn]}
              onPress={handleAddService}
            >
              <Text style={styles.submitText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity onPress={() => router.replace("/home")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="home-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
        <View style={styles.navItemWrapActive}>
          <Ionicons name="cut" size={20} color="#7A5A00" />
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/faq")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("../UserProfile/profile")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="person-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFF8F0" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8D5C4",
    backgroundColor: "#FFFEF9",
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#5D4037",
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  card: {
    marginHorizontal: width * 0.06,
    marginTop: height * 0.04,
    marginBottom: height * 0.04,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 28,
    paddingTop: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 16,
    borderWidth: 1,
    borderColor: "#E8D5C4",
  },
  cardHeader: {
    alignItems: "center",
    paddingBottom: 20,
    borderBottomWidth: 1.5,
    borderBottomColor: "#E8D5C4",
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: width * 0.065,
    fontWeight: "800",
    color: "#5D4037",
  },
  cardSubtitle: {
    fontSize: width * 0.04,
    color: "#8D6E63",
    marginTop: 8,
  },
  uploadBox: {
    height: 200,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: "#E8D5C4",
    borderStyle: "dashed",
    backgroundColor: "#FFFEF9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  imageSection: {
    marginBottom: 32,
  },
  imageCarousel: {
    alignItems: "center",
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  imageNavButton: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  imageNavLeft: {
    left: 10,
  },
  imageNavRight: {
    right: 10,
  },
  imageNavDisabled: {
    opacity: 0.5,
  },
  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 14,
  },
  imageCounter: {
    marginTop: 8,
    fontSize: 14,
    color: "#5D4037",
    fontWeight: "600",
  },
  addImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8D5C4",
    backgroundColor: "#FFFEF9",
  },
  addImageText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#5D4037",
    fontWeight: "600",
  },
  previewImage: { width: "100%", height: "100%", borderRadius: 22 },
  uploadContent: { alignItems: "center", paddingHorizontal: 32 },
  uploadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF8E7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#5D4037",
  },
  uploadSubtext: {
    fontSize: 13.5,
    color: "#8D6E63",
    marginTop: 6,
    textAlign: "center",
  },
  fieldContainer: {
    marginBottom: 28,
  },
  label: {
    fontSize: width * 0.042,
    fontWeight: "700",
    color: "#5D4037",
    marginBottom: 10,
    marginLeft: 4,
  },
  pickerWrapper: {
    borderWidth: 2,
    borderColor: "#E8D5C4",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  picker: {
    height: 54,
    color: "#5D4037",
  },
  input: {
    borderWidth: 2,
    borderColor: "#E8D5C4",
    borderRadius: 18,
    padding: 18,
    fontSize: 15.5,
    backgroundColor: "#ffffff",
    color: "#5D4037",
  },
  priceIndicator: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#B8860B",
    marginLeft: 4,
  },
  totalIndicator: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#B8860B",
    marginLeft: 4,
  },
  textArea: {
    borderWidth: 2,
    borderColor: "#E8D5C4",
    borderRadius: 18,
    padding: 18,
    fontSize: 15.5,
    backgroundColor: "#ffffff",
    minHeight: 130,
    color: "#5D4037",
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E8D5C4",
    borderRadius: 18,
    padding: 18,
  },
  dateTimeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#5D4037",
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  button: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  cancelBtn: {
    backgroundColor: "#FFF8E7",
    borderWidth: 2,
    borderColor: "#E8D5C4",
  },
  submitBtn: {
    backgroundColor: "#B8860B",
    shadowColor: "#B8860B",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  cancelText: {
    color: "#5D4037",
    fontWeight: "700",
    fontSize: 15,
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  navItemWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  navItemWrapActive: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },

  timeSlotLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(93, 64, 55, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(93, 64, 55, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendDotAvailable: {
    backgroundColor: '#22c55e',
  },
  legendDotLimited: {
    backgroundColor: '#f59e0b',
  },
  legendDotFull: {
    backgroundColor: '#ef4444',
  },
  legendText: {
    fontSize: 13,
    color: '#555',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  timeSlotButton: {
    width: (width - 88) / 3,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  timeSlotButtonAvailable: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
  },
  timeSlotButtonLimited: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  timeSlotButtonFull: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    opacity: 0.75,
  },
  timeSlotButtonInactive: {
    backgroundColor: '#f5f5f5',
    borderColor: '#d4d4d4',
    opacity: 0.6,
  },
  timeSlotButtonSelected: {
    backgroundColor: '#22c55e',
    borderColor: '#15803d',
  },
  timeSlotButtonDisabled: {
    opacity: 0.6,
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  slotStatus: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.85,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#8D6E63',
  },
  shopClosedContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  shopClosedText: {
    marginTop: 12,
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
  },
  noSlotsContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noSlotsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8D6E63',
    textAlign: 'center',
  },
  // Simple multi-garment styles
  garmentDivider: {
    height: 1,
    backgroundColor: '#D7CCC8',
    marginVertical: 20,
  },
  garmentRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  garmentLabel: {
    fontWeight: '600',
    color: '#8D6E63',
    fontSize: 15,
  },
  removeGarmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeGarmentText: {
    color: '#ef5350',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  removeGarmentLink: {
    color: '#ef5350',
    fontSize: 14,
  },
  addGarmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#D7CCC8',
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
  },
  addGarmentButtonText: {
    color: '#8D6E63',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8,
  },
  addGarmentLink: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  addGarmentLinkText: {
    color: '#8D6E63',
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  totalPriceContainer: {
    borderTopWidth: 1,
    borderTopColor: '#D7CCC8',
    paddingTop: 16,
    marginBottom: 16,
    backgroundColor: '#FFFEF9',
    padding: 16,
    borderRadius: 12,
  },
  priceBreakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 12,
  },
  priceBreakdownList: {
    marginBottom: 12,
  },
  priceBreakdownItem: {
    fontSize: 14,
    color: '#5D4037',
    marginBottom: 6,
    lineHeight: 20,
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#D7CCC8',
    marginTop: 8,
    paddingTop: 12,
  },
  totalPriceLabel: {
    color: '#5D4037',
    fontSize: 16,
    fontWeight: '700',
  },
  totalPriceValue: {
    color: '#8D6E63',
    fontSize: 20,
    fontWeight: 'bold',
  },
  pickupDateText: {
    fontSize: 13,
    color: '#8D6E63',
    marginTop: 8,
    fontStyle: 'italic',
  },
  estimatedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  estimatedNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  helperText: {
    fontSize: 12,
    color: '#8D6E63',
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
  },
});
