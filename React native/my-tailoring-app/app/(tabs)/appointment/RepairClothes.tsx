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
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import { addRepairToCart, uploadRepairImage } from "../../../utils/repairService";
import apiCall, { appointmentSlotService, API_BASE_URL } from "../../../utils/apiService";
import AsyncStorage from '@react-native-async-storage/async-storage';


const DEFAULT_REPAIR_GARMENT_TYPES = [
  "Shirt", "Pants", "Jacket", "Coat", "Dress", "Skirt", "Suit", "Blouse", "Sweater", "Other"
];

const { width, height } = Dimensions.get("window");

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

interface RepairGarmentItem {
  id: number;
  garmentType: string;
  damageLevel: string;
  notes: string;
}

export default function RepairClothes() {
  const router = useRouter();

  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Multiple garments support
  const [garments, setGarments] = useState<RepairGarmentItem[]>([
    { id: 1, garmentType: '', damageLevel: '', notes: '' }
  ]);
  
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [repairGarmentTypes, setRepairGarmentTypes] = useState<string[]>(DEFAULT_REPAIR_GARMENT_TYPES);
  const [loadingGarments, setLoadingGarments] = useState(false);

  const damageLevels = [
    { value: 'minor', label: 'Minor', basePrice: 300, description: 'Small tears, loose threads, missing buttons' },
    { value: 'moderate', label: 'Moderate', basePrice: 500, description: 'Broken zippers, medium tears, seam repairs' },
    { value: 'major', label: 'Major', basePrice: 800, description: 'Large tears, structural damage, extensive repairs' },
    { value: 'severe', label: 'Severe', basePrice: 1500, description: 'Complete reconstruction, multiple major issues' }
  ];

  // Garment management functions
  const addGarment = () => {
    const newId = Math.max(...garments.map(g => g.id)) + 1;
    setGarments([...garments, { id: newId, garmentType: '', damageLevel: '', notes: '' }]);
  };

  const removeGarment = (id: number) => {
    if (garments.length > 1) {
      setGarments(garments.filter(g => g.id !== id));
    }
  };

  const updateGarment = (id: number, field: keyof RepairGarmentItem, value: string) => {
    setGarments(garments.map(g => 
      g.id === id ? { ...g, [field]: value } : g
    ));
  };

  // Calculate total price based on all garments
  const calculateTotalPrice = (): number => {
    return garments.reduce((total, garment) => {
      if (!garment.damageLevel) return total;
      const damageLevelObj = damageLevels.find(level => level.value === garment.damageLevel);
      let basePrice = damageLevelObj ? damageLevelObj.basePrice : 500;
      
      // Apply garment multiplier
      let garmentMultiplier = 1.0;
      if (garment.garmentType === 'Suit' || garment.garmentType === 'Coat') {
        garmentMultiplier = 1.3;
      } else if (garment.garmentType === 'Dress') {
        garmentMultiplier = 1.2;
      }
      
      return total + Math.round(basePrice * garmentMultiplier);
    }, 0);
  };

  
  useEffect(() => {
    console.log('=== [RepairClothes] Component MOUNTED - DYNAMIC VERSION ===');
    loadRepairGarmentTypes();
  }, []);

  
  useFocusEffect(
    useCallback(() => {
      console.log('[RepairClothes] Screen focused, refreshing repair garment types...');
      loadRepairGarmentTypes();
    }, [])
  );

  const loadRepairGarmentTypes = async () => {
    setLoadingGarments(true);
    console.log('=== [RepairClothes] loadRepairGarmentTypes CALLED ===');
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('[RepairClothes] Token:', token ? 'Retrieved' : 'Missing');
      
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.180:5000/api';
      const url = `${baseUrl}/repair-garment-types`;
      console.log('[RepairClothes] Fetching:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[RepairClothes] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[RepairClothes] API returned', data.garments?.length || 0, 'items');
        console.log('[RepairClothes] Raw API response:', JSON.stringify(data));
        
        
        if (data.success && data.garments && data.garments.length > 0) {
          const garmentTypes = data.garments
            .filter((g: any) => g.is_active === 1 || g.is_active === true)
            .map((garment: any) => garment.garment_name);
          
          if (garmentTypes.length > 0) {
            setRepairGarmentTypes(garmentTypes);
            console.log('✅ [RepairClothes] SUCCESS - Loaded', garmentTypes.length, 'garment types from API');
            console.log('✅ [RepairClothes] Types:', garmentTypes.join(', '));
          } else {
            console.log('[RepairClothes] No active garment types found, using defaults');
          }
        } else {
          console.log('[RepairClothes] API returned empty data, using defaults');
        }
      } else {
        const errorText = await response.text();
        console.log('[RepairClothes] API error:', response.status, errorText);
      }
    } catch (error: any) {
      console.log('[RepairClothes] FETCH ERROR:', error.message || error);
    } finally {
      setLoadingGarments(false);
      console.log('[RepairClothes] Loading complete');
    }
  };

  useEffect(() => {
    if (garments.some(g => g.damageLevel)) {
      setEstimatedPrice(calculateTotalPrice());
    } else {
      setEstimatedPrice(0);
    }
  }, [garments]);

  const getEstimatedTime = (damageLevel: string) => {
    const times: {[key: string]: string} = {
      'minor': '2-3 days',
      'moderate': '3-5 days',
      'major': '5-7 days',
      'severe': '1-2 weeks'
    };
    return times[damageLevel] || '3-5 days';
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImagePreview(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
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
    
    setAppointmentDate(selectedDate);
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
      const result = await appointmentSlotService.getAllSlotsWithAvailability('repair', dateStr);
      
      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setTimeSlots([]);
          Alert.alert('Shop Closed', 'The shop is closed on this date. Please select another date.');
          return;
        }
        
        setIsShopOpen(true);
        setTimeSlots(result.slots || []);
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

  const handlePickerCancel = () => {
    setShowDatePicker(false);
  };

  useFocusEffect(
    useCallback(() => {
      
      if (appointmentDate) {
        loadTimeSlots(appointmentDate);
      }
    }, [appointmentDate])
  );

  useEffect(() => {
    if (!appointmentDate) return;

    loadTimeSlots(appointmentDate);

    const refreshInterval = setInterval(() => {
      
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      appointmentSlotService.getAllSlotsWithAvailability('repair', dateStr, 5000)
        .then((result) => {
          if (result.success && result.slots) {
            
            setTimeSlots((currentSlots) => {
              
              const currentCounts = JSON.stringify(currentSlots.map(s => ({ time: s.time_slot, available: s.available })));
              const newCounts = JSON.stringify(result.slots.map(s => ({ time: s.time_slot, available: s.available })));
              
              if (currentCounts !== newCounts) {
                
                if (!result.isShopOpen) {
                  setIsShopOpen(false);
                  return [];
                } else {
                  setIsShopOpen(true);
                  return result.slots || [];
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
  }, [appointmentDate]); 

  const uploadImageIfNeeded = async () => {
    if (!image) return null;

    try {
      const formData = new FormData();
      formData.append('repairImage', {
        uri: image,
        type: 'image/jpeg',
        name: 'repair-image.jpg',
      } as any);

      const response = await uploadRepairImage(formData);
      const result = await response.json();
      
      if (result.success) {
        return result.data.url || result.data.filename;
      } else {
        throw new Error(result.message || 'Image upload failed');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  const handleAddService = async () => {
    // Validate garments
    const validGarments = garments.filter(g => g.garmentType && g.damageLevel && g.notes);
    if (validGarments.length === 0) {
      Alert.alert(
        "Missing Information",
        "Please add at least one garment with type, damage level, and description"
      );
      return;
    }

    // Check all required fields for each garment
    for (const garment of garments) {
      if (!garment.garmentType || !garment.damageLevel || !garment.notes) {
        Alert.alert(
          "Missing Information",
          "Please fill in all required fields for each garment"
        );
        return;
      }
    }

    if (!appointmentDate) {
      Alert.alert(
        "Missing Information",
        "Please select a drop-off date"
      );
      return;
    }

    if (!selectedTimeSlot) {
      Alert.alert(
        "Missing Information",
        "Please select a time slot"
      );
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

    setLoading(true);
    
    try {
      
      let slotResult = null;
      try {
        
        const year = appointmentDate.getFullYear();
        const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
        const day = String(appointmentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        slotResult = await appointmentSlotService.bookSlot('repair', dateStr, selectedTimeSlot);
        if (!slotResult || !slotResult.success) {
          const errorMsg = slotResult?.message || 'Failed to book appointment slot. This time may already be taken.';
          console.error('Slot booking failed:', slotResult);
          Alert.alert('Slot Unavailable', errorMsg);
          setLoading(false);
          return;
        }
        console.log('Slot booked successfully:', slotResult);
      } catch (slotError: any) {
        console.error('Slot booking error:', slotError);
        const errorMsg = slotError.message || 'Failed to book appointment slot. Please try again.';
        Alert.alert('Booking Error', errorMsg);
        setLoading(false);
        return;
      }

      let imageUrl = '';
      if (image) {
        try {
          imageUrl = await uploadImageIfNeeded() || 'no-image';
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          Alert.alert('Warning', 'Image upload failed. Continuing without image.');
        }
      }

      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const pickupDateTime = `${dateStr}T${selectedTimeSlot}`;

      // Build garments array for submission
      const garmentsData = garments.map(garment => {
        const damageLevelObj = damageLevels.find(level => level.value === garment.damageLevel);
        const basePrice = damageLevelObj ? damageLevelObj.basePrice : 500;
        return {
          damageLevel: garment.damageLevel,
          garmentType: garment.garmentType,
          notes: garment.notes,
          basePrice: basePrice
        };
      });

      const repairData = {
        serviceType: 'repair', 
        serviceId: 1, 
        quantity: garments.length, 
        serviceName: 'Repair Service',
        basePrice: estimatedPrice.toString(),
        finalPrice: estimatedPrice.toString(), 
        pickupDate: pickupDateTime, 
        appointmentTime: selectedTimeSlot, 
        imageUrl: imageUrl || 'no-image',
        garments: garmentsData,
        isMultipleGarments: garments.length > 1
      };

      console.log('Sending repair data to cart:', JSON.stringify(repairData, null, 2));

      const result = await addRepairToCart(repairData);
      
      if (result.success) {
        Alert.alert(
          "Success!", 
          `Repair service added to cart! Estimated price: ₱${estimatedPrice}`, 
          [
            {
              text: "View Cart",
              onPress: () => router.push("/(tabs)/cart/Cart"),
            },
            {
              text: "Add More",
              onPress: () => {
                setGarments([{ id: 1, garmentType: '', damageLevel: '', notes: '' }]);
                setImage(null);
                setImagePreview(null);
                setAppointmentDate(null);
                setSelectedTimeSlot("");
                setTimeSlots([]);
                setEstimatedPrice(0);
              },
            },
          ]
        );
      } else {
        throw new Error(result.message || "Failed to add repair service to cart");
      }
    } catch (error: any) {
      console.error("Add service error:", error);
      
      let errorMessage = error.message || "Failed to add repair service. Please try again.";

      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        errorMessage = "Network error: Unable to connect to the server. Please check your internet connection and ensure the backend server is running."
      }
      
      Alert.alert(
        "Error Adding to Cart", 
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color="#5D4037" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔧 Repair Request</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Repair Request</Text>
            <Text style={styles.cardSubtitle}>We&apos;ll make it good as new</Text>
          </View>
          <Text style={styles.sectionTitle}>Upload Damage Photo (Recommended)</Text>
          <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
            {imagePreview ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imagePreview }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={40} color="#8D6E63" />
                <Text style={styles.uploadText}>Tap to upload photo of damage</Text>
                <Text style={styles.uploadSubtext}>Clear image helps us serve you better</Text>
              </View>
            )}
          </TouchableOpacity>

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

              <Text style={styles.sectionTitle}>Damage Level *</Text>
              <View style={styles.damageLevelContainer}>
                {damageLevels.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={[
                      styles.damageLevelCard,
                      garment.damageLevel === level.value && styles.damageLevelCardSelected,
                    ]}
                    onPress={() => updateGarment(garment.id, 'damageLevel', level.value)}
                  >
                    <View style={styles.damageLevelHeader}>
                      <Text style={[
                        styles.damageLevelLabel,
                        garment.damageLevel === level.value && styles.damageLevelLabelSelected,
                      ]}>
                        {level.label} - ₱{level.basePrice}
                      </Text>
                      {garment.damageLevel === level.value && (
                        <Ionicons name="checkmark-circle" size={20} color="#B8860B" />
                      )}
                    </View>
                    <Text style={[
                      styles.damageLevelDescription,
                      garment.damageLevel === level.value && styles.damageLevelDescriptionSelected,
                    ]}>
                      {level.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.sectionTitle}>Garment Type *</Text>
              {loadingGarments ? (
                <View style={[styles.pickerWrapper, { justifyContent: 'center', alignItems: 'center', paddingVertical: 15 }]}>
                  <ActivityIndicator size="small" color="#8D6E63" />
                </View>
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={garment.garmentType}
                    onValueChange={(value) => updateGarment(garment.id, 'garmentType', value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select garment type..." value="" />
                    {repairGarmentTypes.map((item, idx) => (
                      <Picker.Item label={item} value={item} key={`${garment.id}-${item}-${idx}`} />
                    ))}
                  </Picker>
                </View>
              )}
              
              <Text style={styles.sectionTitle}>Damage Description *</Text>
              <TextInput
                placeholder="Describe the damage in detail..."
                style={styles.textArea}
                placeholderTextColor="#999"
                multiline
                value={garment.notes}
                onChangeText={(value) => updateGarment(garment.id, 'notes', value)}
                textAlignVertical="top"
              />
            </View>
          ))}
          
          <TouchableOpacity style={styles.addGarmentButton} onPress={addGarment}>
            <Ionicons name="add-circle-outline" size={20} color="#8D6E63" />
            <Text style={styles.addGarmentButtonText}>Add Another Garment</Text>
          </TouchableOpacity>

          {/* Total Price Display */}
          {garments.some(g => g.damageLevel) && (
            <View style={styles.totalPriceRow}>
              <Text style={styles.totalPriceLabel}>Estimated Total:</Text>
              <Text style={styles.totalPriceValue}>₱{estimatedPrice}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Preferred Appointment Date *</Text>
          <Text style={styles.sectionSubtitle}>Select a date when the shop is open</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#8D6E63" />
            <Text style={styles.datePickerText}>
              {appointmentDate
                ? appointmentDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Tap to select date"}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#8D6E63" />
          </TouchableOpacity>
          {appointmentDate && (
            <>
              <Text style={styles.sectionTitle}>Select Time Slot *</Text>
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
                  <ActivityIndicator size="small" color="#B8860B" />
                  <Text style={styles.loadingText}>Loading time slots...</Text>
                </View>
              ) : !isShopOpen ? (
                <View style={styles.shopClosedContainer}>
                  <Ionicons name="close-circle" size={40} color="#ef4444" />
                  <Text style={styles.shopClosedText}>
                    The shop is closed on this date. Please select another date.
                  </Text>
                </View>
              ) : timeSlots.length > 0 ? (
                <View style={styles.timeSlotsGrid}>
                  {(() => {
                    
                    const seenTimes = new Set<string>();
                    const uniqueSlots = timeSlots.filter((slot) => {
                      if (seenTimes.has(slot.time_slot)) {
                        return false;
                      }
                      seenTimes.add(slot.time_slot);
                      return true;
                    });
                    
                    return uniqueSlots.map((slot) => (
                      <TouchableOpacity
                        key={slot.slot_id || slot.time_slot}
                        style={[
                          styles.timeSlotButton,
                          styles[`timeSlotButton${slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}`],
                          selectedTimeSlot === slot.time_slot && styles.timeSlotButtonSelected,
                          !slot.isClickable && styles.timeSlotButtonDisabled,
                        ]}
                        onPress={() => {
                          if (slot.isClickable) {
                            setSelectedTimeSlot(slot.time_slot);
                          }
                        }}
                        disabled={!slot.isClickable}
                      >
                        <Text style={styles.slotTime}>{slot.display_time}</Text>
                        <Text style={styles.slotStatus}>
                          {slot.status === 'full' ? 'Fully Booked' : 
                           slot.status === 'limited' ? `${slot.available} LEFT` : 
                           slot.status === 'available' ? `${slot.available} SPOTS` : 'Unavailable'}
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </View>
              ) : (
                <View style={styles.noSlotsContainer}>
                  <Ionicons name="calendar-outline" size={40} color="#8D6E63" />
                  <Text style={styles.noSlotsText}>
                    No time slots available for this date. Please select another date.
                  </Text>
                </View>
              )}
            </>
          )}
          {estimatedPrice > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Estimated Price: ₱{estimatedPrice}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items:</Text>
                <Text style={styles.summaryValue}>{garments.length} garment(s)</Text>
              </View>
              {garments.filter(g => g.damageLevel).map((g, idx) => (
                <View key={g.id} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{g.garmentType || `Garment ${idx + 1}`}:</Text>
                  <Text style={styles.summaryValue}>{damageLevels.find(l => l.value === g.damageLevel)?.label || g.damageLevel}</Text>
                </View>
              ))}
              <Text style={styles.summaryNote}>
                Final price will be confirmed after admin review
              </Text>
            </View>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push("./appointmentSelection")}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={20} color="#5D4037" />
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, (!estimatedPrice || loading) && styles.buttonDisabled]}
              onPress={handleAddService}
              disabled={loading || !estimatedPrice}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={20} color="#FFF" />
                  <Text style={styles.primaryButtonText}>
                    Add to Cart - ₱{estimatedPrice || 0}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <DateTimePickerModal
        visible={showDatePicker}
        mode="date"
        value={appointmentDate || new Date()}
        minimumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={handlePickerCancel}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5C4',
    backgroundColor: '#FFFEF9',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D4037',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  cardHeader: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5C4',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8D6E63',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5D4037',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8D6E63',
    marginBottom: 12,
    marginTop: -4,
  },
  imageUpload: {
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8D5C4',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 20,
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFEF9',
  },
  uploadText: {
    marginTop: 8,
    color: '#8D6E63',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadSubtext: {
    marginTop: 4,
    color: '#8D6E63',
    fontSize: 12,
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    backgroundColor: '#FFF',
    overflow: 'hidden',
    marginBottom: 16,
  },
  picker: {
    height: 50,
    color: '#333',
  },
  damageLevelContainer: {
    marginBottom: 16,
  },
  damageLevelCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E8D5C4',
  },
  damageLevelCardSelected: {
    borderColor: '#B8860B',
    backgroundColor: '#FFF8E7',
  },
  damageLevelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  damageLevelLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5D4037',
  },
  damageLevelLabelSelected: {
    color: '#B8860B',
  },
  damageLevelDescription: {
    fontSize: 13,
    color: '#8D6E63',
    lineHeight: 18,
  },
  damageLevelDescriptionSelected: {
    color: '#5D4037',
  },
  priceIndicator: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#B8860B',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  smallText: {
    fontSize: 12,
    color: '#8D6E63',
    marginTop: 6,
    marginBottom: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFF',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  summaryCard: {
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8D6E63',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4037',
  },
  summaryNote: {
    fontSize: 12,
    color: '#8D6E63',
    fontStyle: 'italic',
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B8860B',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
    flex: 1,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#5D4037',
  },
  secondaryButtonText: {
    color: '#5D4037',
    fontSize: 16,
    fontWeight: '600',
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
    textDecorationLine: 'underline',
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
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#D7CCC8',
    marginBottom: 16,
  },
  totalPriceLabel: {
    color: '#5D4037',
    fontSize: 16,
    fontWeight: '500',
  },
  totalPriceValue: {
    color: '#8D6E63',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
