
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from '../../../components/DateTimePickerModal';
import { addCustomizationToCart, uploadCustomizationImage } from '../../../utils/customizationService';
import { appointmentSlotService } from '../../../utils/apiService';

const { width, height } = Dimensions.get('window');

interface CustomizationModalProps {
  visible: boolean;
  onClose: () => void;
}

const DEFAULT_GARMENT_TYPES = [
  { id: 'shirt', label: 'Shirt', icon: 'shirt-outline', price: 800 },
  { id: 'pants', label: 'Pants', icon: 'body-outline', price: 900 },
  { id: 'suit', label: 'Suit', icon: 'briefcase-outline', price: 2500 },
  { id: 'dress', label: 'Dress', icon: 'woman-outline', price: 1800 },
  { id: 'blazer', label: 'Blazer', icon: 'shirt-outline', price: 2000 },
  { id: 'barong', label: 'Barong', icon: 'shirt-outline', price: 3000 },
  { id: 'uniform', label: 'Uniform', icon: 'school-outline', price: 0 },
];

const DEFAULT_FABRIC_TYPES = [
  { id: 'cotton', label: 'Cotton', price: 200 },
  { id: 'silk', label: 'Silk', price: 300 },
  { id: 'linen', label: 'Linen', price: 400 },
  { id: 'wool', label: 'Wool', price: 200 },
  { id: 'polyester', label: 'Polyester', price: 150 },
];

const getGarmentIcon = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('pants') || lowerName.includes('trouser')) return 'body-outline';
  if (lowerName.includes('suit')) return 'briefcase-outline';
  if (lowerName.includes('dress') || lowerName.includes('gown')) return 'woman-outline';
  if (lowerName.includes('uniform')) return 'school-outline';
  return 'shirt-outline';
};

export default function CustomizationModal({ visible, onClose }: CustomizationModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<string>('');
  const [selectedFabric, setSelectedFabric] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [preferredDate, setPreferredDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [garmentTypes, setGarmentTypes] = useState(DEFAULT_GARMENT_TYPES);
  const [loadingGarments, setLoadingGarments] = useState(false);

  const [fabricTypes, setFabricTypes] = useState(DEFAULT_FABRIC_TYPES);
  const [loadingFabrics, setLoadingFabrics] = useState(false);

  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);

  const [showGarmentPicker, setShowGarmentPicker] = useState(false);
  const [showFabricPicker, setShowFabricPicker] = useState(false);

  useEffect(() => {
    console.log('[Customization] useEffect for garmentTypes - visible:', visible);
    if (visible) {
      loadGarmentTypes();
      loadFabricTypes();
    }
  }, [visible]);

  useEffect(() => {
    console.log('[Customization] useEffect for timeSlots - visible:', visible, 'preferredDate:', preferredDate?.toISOString());
    if (visible && preferredDate) {
      loadTimeSlots();
    }
  }, [visible, preferredDate.getTime()]);

  const loadTimeSlots = async () => {
    console.log('=== [Customization] loadTimeSlots called ===');
    setLoadingSlots(true);
    setSelectedTimeSlot('');
    try {

      const year = preferredDate.getFullYear();
      const month = String(preferredDate.getMonth() + 1).padStart(2, '0');
      const day = String(preferredDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      console.log('[Customization] Loading time slots for date:', dateStr);
      console.log('[Customization] Calling appointmentSlotService.getAllSlotsWithAvailability...');
      const result = await appointmentSlotService.getAllSlotsWithAvailability('customization', dateStr);
      console.log('[Customization] API Response:', JSON.stringify(result, null, 2));
      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setTimeSlots([]);
          return;
        }
        setIsShopOpen(true);
        console.log('[Customization] Setting', result.slots?.length || 0, 'time slots');
        setTimeSlots(result.slots || []);
      } else {
        console.log('[Customization] No slots - success:', result.success, 'message:', result.message);
        setTimeSlots([]);
      }
    } catch (error: any) {
      console.log('[Customization] ERROR loading time slots:', error.message || error);
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
      console.log('[Customization] loadTimeSlots completed');
    }
  };

  const loadTimeSlotsForDate = async (date: Date) => {
    console.log('=== [Customization] loadTimeSlotsForDate called ===');
    setLoadingSlots(true);
    setSelectedTimeSlot('');
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      console.log('[Customization] Loading time slots for date:', dateStr);
      const result = await appointmentSlotService.getAllSlotsWithAvailability('customization', dateStr);
      console.log('[Customization] API Response:', JSON.stringify(result, null, 2));
      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setTimeSlots([]);
          return;
        }
        setIsShopOpen(true);
        console.log('[Customization] Setting', result.slots?.length || 0, 'time slots');
        setTimeSlots(result.slots || []);
      } else {
        console.log('[Customization] No slots - success:', result.success, 'message:', result.message);
        setTimeSlots([]);
      }
    } catch (error: any) {
      console.log('[Customization] ERROR loading time slots:', error.message || error);
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const loadGarmentTypes = async () => {
    setLoadingGarments(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.202:5000/api'}/garment-types`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.garments && data.garments.length > 0) {
          const transformedGarments = data.garments
            .filter((g: any) => g.is_active === 1)
            .map((garment: any) => ({
              id: garment.garment_code || garment.garment_name.toLowerCase().replace(/\s+/g, '_'),
              label: garment.garment_name,
              icon: getGarmentIcon(garment.garment_name),
              price: parseFloat(garment.garment_price) || 0,
            }));

          const hasUniform = transformedGarments.some((g: any) => g.id.toLowerCase() === 'uniform');
          if (!hasUniform) {
            transformedGarments.push({ id: 'uniform', label: 'Uniform', icon: 'school-outline', price: 0 });
          }

          if (transformedGarments.length > 0) {
            setGarmentTypes(transformedGarments);
            console.log('✅ Loaded garment types for modal:', transformedGarments);
          }
        }
      }
    } catch (error) {
      console.log('Error loading garment types:', error);

    } finally {
      setLoadingGarments(false);
    }
  };

  const loadFabricTypes = async () => {
    setLoadingFabrics(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.202:5000/api'}/fabric-types`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.fabrics && data.fabrics.length > 0) {
          const transformedFabrics = data.fabrics.map((fabric: any) => ({
            id: fabric.fabric_name.toLowerCase().replace(/\s+/g, '_'),
            label: fabric.fabric_name,
            price: parseFloat(fabric.fabric_price) || 0,
          }));

          if (transformedFabrics.length > 0) {
            setFabricTypes(transformedFabrics);
            console.log('✅ Loaded fabric types for modal:', transformedFabrics);
          }
        }
      }
    } catch (error) {
      console.log('Error loading fabric types:', error);

    } finally {
      setLoadingFabrics(false);
    }
  };

  const resetForm = () => {
    setImage(null);
    setSelectedGarment('');
    setSelectedFabric('');
    setNotes('');
    setPreferredDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setSelectedTimeSlot('');
    setTimeSlots([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleDateConfirm = async (selectedDate: Date) => {
    setPreferredDate(selectedDate);
    setShowDatePicker(false);
    setSelectedTimeSlot('');

    await loadTimeSlotsForDate(selectedDate);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const getSelectedGarmentPrice = () => {
    const garment = garmentTypes.find(g => g.id === selectedGarment);
    return garment?.price || 1000;
  };

  const handleOpen3DCustomizer = () => {
    handleClose();
    router.push('/(tabs)/appointment/Customizer3D');
  };

  const handleAddToCart = async () => {
    if (!selectedGarment) {
      Alert.alert('Missing Information', 'Please select a garment type');
      return;
    }
    if (!selectedFabric) {
      Alert.alert('Missing Information', 'Please select a fabric type');
      return;
    }
    if (!selectedTimeSlot) {
      Alert.alert('Missing Information', 'Please select a time slot');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = 'no-image';

      if (image) {
        try {
          const formData = new FormData();
          formData.append('customizationImage', {
            uri: image,
            type: 'image/jpeg',
            name: 'customization.jpg',
          } as any);

          const uploadResponse = await uploadCustomizationImage(formData);
          imageUrl = uploadResponse.imageUrl || uploadResponse.data?.imageUrl || 'no-image';
        } catch (uploadError) {
          console.log('Image upload failed, continuing without image');
        }
      }

      const year = preferredDate.getFullYear();
      const month = String(preferredDate.getMonth() + 1).padStart(2, '0');
      const day = String(preferredDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      let slotResult = null;
      try {
        slotResult = await appointmentSlotService.bookSlot('customization', dateStr, selectedTimeSlot);
        if (!slotResult?.success) {
          const errorMsg = slotResult?.message || 'Failed to book appointment slot. This time may already be taken.';
          console.error('Slot booking failed:', slotResult);
          throw new Error(errorMsg);
        }
        console.log('Slot booked successfully:', slotResult);
      } catch (slotError: any) {
        console.error('Slot booking error:', slotError);
        const errorMsg = slotError.message || 'Failed to book appointment slot. Please try again.';
        throw new Error(errorMsg);
      }

      const isUniform = selectedGarment === 'uniform';
      const garmentLabel = garmentTypes.find(g => g.id === selectedGarment)?.label || selectedGarment;

      await addCustomizationToCart({
        garmentType: garmentLabel,
        fabricType: fabricTypes.find((f: any) => f.id === selectedFabric)?.label || selectedFabric,
        preferredDate: dateStr,
        preferredTime: selectedTimeSlot,
        notes: notes,
        imageUrl: imageUrl,
        estimatedPrice: isUniform ? 0 : getSelectedGarmentPrice(),
        isUniform: isUniform,
      });

      Alert.alert(
        'Success!',
        'Customization added to cart!',
        [
          {
            text: 'View Cart',
            onPress: () => {
              handleClose();
              router.push('/cart/Cart');
            },
          },
          {
            text: 'Continue',
            onPress: handleClose,
          },
        ]
      );
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', error.message || 'Failed to add to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#5D4037" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🧥 Customization Service</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.banner3D}
            onPress={handleOpen3DCustomizer}
            activeOpacity={0.8}
          >
            <View style={styles.banner3DIcon}>
              <MaterialCommunityIcons name="creation" size={40} color="#B8860B" />
            </View>
            <View style={styles.banner3DText}>
              <Text style={styles.banner3DTitle}>✨ Try Our 3D Customizer</Text>
              <Text style={styles.banner3DSubtitle}>
                Design your garment in interactive 3D view
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#B8860B" />
          </TouchableOpacity>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR fill out the form</Text>
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.sectionTitle}>Select Garment Type</Text>
          {loadingGarments ? (
            <ActivityIndicator size="small" color="#B8860B" style={{ marginVertical: 20 }} />
          ) : (
            <TouchableOpacity
              style={styles.dropdownSelector}
              onPress={() => setShowGarmentPicker(true)}
            >
              <View style={styles.dropdownLeft}>
                <Ionicons name="shirt-outline" size={20} color="#8D6E63" />
                <Text style={[styles.dropdownText, !selectedGarment && styles.dropdownPlaceholder]}>
                  {selectedGarment ? garmentTypes.find(g => g.id === selectedGarment)?.label : 'Select a garment type'}
                </Text>
              </View>
              <View style={styles.dropdownRight}>
                {selectedGarment && (
                  <Text style={styles.dropdownPrice}>
                    {selectedGarment === 'uniform' ? 'Price varies' : `₱${garmentTypes.find(g => g.id === selectedGarment)?.price?.toLocaleString() || 0}`}
                  </Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#8D6E63" />
              </View>
            </TouchableOpacity>
          )}
          <Modal
            visible={showGarmentPicker}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowGarmentPicker(false)}
          >
            <TouchableOpacity
              style={styles.pickerModalOverlay}
              activeOpacity={1}
              onPress={() => setShowGarmentPicker(false)}
            >
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Garment Type</Text>
                  <TouchableOpacity onPress={() => setShowGarmentPicker(false)}>
                    <Ionicons name="close" size={24} color="#5D4037" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerScroll}>
                  {garmentTypes.map((garment, index) => (
                    <TouchableOpacity
                      key={`${garment.id}-${index}`}
                      style={[
                        styles.pickerOption,
                        selectedGarment === garment.id && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedGarment(garment.id);
                        setShowGarmentPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        selectedGarment === garment.id && styles.pickerOptionTextSelected,
                      ]}>
                        {garment.label}
                      </Text>
                      <Text style={[
                        styles.pickerOptionPrice,
                        selectedGarment === garment.id && styles.pickerOptionPriceSelected,
                      ]}>
                        {garment.id === 'uniform' ? 'Price varies' : `₱${garment.price.toLocaleString()}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
          {selectedGarment === 'uniform' && (
            <View style={styles.uniformNotice}>
              <Ionicons name="information-circle" size={24} color="#e65100" />
              <View style={styles.uniformNoticeText}>
                <Text style={styles.uniformNoticeTitle}>Uniform Selected</Text>
                <Text style={styles.uniformNoticeDesc}>
                  Please upload a clear picture of your uniform. Price will be determined based on type and complexity.
                </Text>
              </View>
            </View>
          )}
          <Text style={styles.sectionTitle}>Select Fabric</Text>
          {loadingFabrics ? (
            <ActivityIndicator size="small" color="#B8860B" style={{ marginVertical: 20 }} />
          ) : (
          <TouchableOpacity
            style={styles.dropdownSelector}
            onPress={() => setShowFabricPicker(true)}
          >
            <View style={styles.dropdownLeft}>
              <MaterialCommunityIcons name="palette-swatch-outline" size={20} color="#8D6E63" />
              <Text style={[styles.dropdownText, !selectedFabric && styles.dropdownPlaceholder]}>
                {selectedFabric ? fabricTypes.find(f => f.id === selectedFabric)?.label : 'Select a fabric type'}
              </Text>
            </View>
            <View style={styles.dropdownRight}>
              {selectedFabric && (
                <Text style={styles.dropdownPrice}>
                  ₱{fabricTypes.find(f => f.id === selectedFabric)?.price?.toLocaleString() || 0}
                </Text>
              )}
              <Ionicons name="chevron-down" size={20} color="#8D6E63" />
            </View>
          </TouchableOpacity>
          )}
          <Modal
            visible={showFabricPicker}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowFabricPicker(false)}
          >
            <TouchableOpacity
              style={styles.pickerModalOverlay}
              activeOpacity={1}
              onPress={() => setShowFabricPicker(false)}
            >
              <View style={styles.pickerModal}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Fabric Type</Text>
                  <TouchableOpacity onPress={() => setShowFabricPicker(false)}>
                    <Ionicons name="close" size={24} color="#5D4037" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerScroll}>
                  {fabricTypes.map((fabric, index) => (
                    <TouchableOpacity
                      key={`${fabric.id}-${index}`}
                      style={[
                        styles.pickerOption,
                        selectedFabric === fabric.id && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedFabric(fabric.id);
                        setShowFabricPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        selectedFabric === fabric.id && styles.pickerOptionTextSelected,
                      ]}>
                        {fabric.label}
                      </Text>
                      <Text style={[
                        styles.pickerOptionPrice,
                        selectedFabric === fabric.id && styles.pickerOptionPriceSelected,
                      ]}>
                        ₱{fabric.price?.toLocaleString() || 0}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
          <Text style={styles.sectionTitle}>
            Reference Image {selectedGarment === 'uniform' ? '(Required for Uniform)' : '(Optional)'}
          </Text>
          <TouchableOpacity style={[styles.imageUpload, selectedGarment === 'uniform' && !image && styles.imageUploadRequired]} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.previewImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={40} color="#8D6E63" />
                <Text style={styles.uploadText}>Tap to upload image</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Preferred Appointment Date</Text>
          <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color="#8D6E63" />
            <Text style={styles.datePickerText}>
              {preferredDate.toLocaleDateString()}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#8D6E63" />
          </TouchableOpacity>

          <DateTimePickerModal
            visible={showDatePicker}
            mode="date"
            value={preferredDate}
            minimumDate={new Date()}
            onConfirm={handleDateConfirm}
            onCancel={handleDateCancel}
          />
          <Text style={styles.sectionTitle}>Select Time Slot</Text>
          <View style={styles.legendContainer}>
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
                      slot.status === 'available' && styles.timeSlotButtonAvailable,
                      slot.status === 'limited' && styles.timeSlotButtonLimited,
                      slot.status === 'full' && styles.timeSlotButtonFull,
                      slot.status === 'inactive' && styles.timeSlotButtonInactive,
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
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any special requests or design details..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholderTextColor="#999"
          />
          {selectedGarment && selectedFabric && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Estimated Price</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Garment:</Text>
                <Text style={styles.summaryValue}>
                  {garmentTypes.find(g => g.id === selectedGarment)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fabric:</Text>
                <Text style={styles.summaryValue}>
                  {fabricTypes.find((f: any) => f.id === selectedFabric)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Price:</Text>
                {selectedGarment === 'uniform' ? (
                  <Text style={[styles.summaryPrice, { color: '#e65100' }]}>Price varies by type</Text>
                ) : (
                  <Text style={styles.summaryPrice}>₱{getSelectedGarmentPrice().toLocaleString()}</Text>
                )}
              </View>
              {selectedGarment === 'uniform' && (
                <Text style={styles.uniformPriceNote}>
                  Our team will provide an accurate quote after reviewing your order.
                </Text>
              )}
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              styles.addToCartButton,
              (!selectedGarment || !selectedFabric || !selectedTimeSlot) && styles.buttonDisabled
            ]}
            onPress={handleAddToCart}
            disabled={loading || !selectedGarment || !selectedFabric || !selectedTimeSlot}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="cart-outline" size={20} color="#FFF" />
                <Text style={styles.primaryButtonText}>Add to Cart</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
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

  banner3D: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#B8860B',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  banner3DIcon: {
    marginRight: 12,
  },
  banner3DText: {
    flex: 1,
  },
  banner3DTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 2,
  },
  banner3DSubtitle: {
    fontSize: 12,
    color: '#8D6E63',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8D5C4',
  },
  dividerText: {
    paddingHorizontal: 12,
    color: '#8D6E63',
    fontSize: 13,
    fontWeight: '500',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5D4037',
    marginBottom: 12,
    marginTop: 8,
  },

  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  dropdownPrice: {
    fontSize: 13,
    color: '#B8860B',
    fontWeight: '600',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5C4',
    backgroundColor: '#FFFEF9',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5D4037',
  },
  pickerScroll: {
    padding: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#FFFEF9',
  },
  pickerOptionSelected: {
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: '#B8860B',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#5D4037',
  },
  pickerOptionTextSelected: {
    color: '#B8860B',
    fontWeight: '600',
  },
  pickerOptionPrice: {
    fontSize: 14,
    color: '#8D6E63',
  },
  pickerOptionPriceSelected: {
    color: '#B8860B',
    fontWeight: '600',
  },

  fabricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  fabricChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8D5C4',
  },
  fabricChipSelected: {
    backgroundColor: '#B8860B',
    borderColor: '#B8860B',
  },
  fabricLabel: {
    fontSize: 13,
    color: '#5D4037',
    fontWeight: '500',
  },
  fabricLabelSelected: {
    color: '#FFF',
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
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  summaryCard: {
    backgroundColor: '#FFF',
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
  summaryPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B8860B',
  },

  textArea: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8D5C4',
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
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

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B8860B',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  addToCartButton: {
    flex: 1,
  },

  uniformCard: {
    borderColor: '#ffb74d',
    backgroundColor: '#fff3e0',
  },
  uniformPrice: {
    color: '#e65100',
    fontWeight: '600',
    fontSize: 11,
  },
  uniformNotice: {
    flexDirection: 'row',
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffb74d',
    alignItems: 'flex-start',
    gap: 10,
  },
  uniformNoticeText: {
    flex: 1,
  },
  uniformNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e65100',
    marginBottom: 4,
  },
  uniformNoticeDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  uniformPriceNote: {
    fontSize: 12,
    color: '#e65100',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  imageUploadRequired: {
    borderColor: '#e65100',
    borderWidth: 2,
    borderStyle: 'dashed',
  },

  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFEF9',
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
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  shopClosedText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  noSlotsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  noSlotsText: {
    fontSize: 14,
    color: '#8D6E63',
    textAlign: 'center',
  },
});
