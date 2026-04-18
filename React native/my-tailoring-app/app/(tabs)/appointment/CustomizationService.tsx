
import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from '../../../components/DateTimePickerModal';
import { addCustomizationToCart, uploadCustomizationImage } from '../../../utils/customizationService';
import { appointmentSlotService } from '../../../utils/apiService';
import { filterUserAllowedSlots } from '../../../utils/appointmentSlotFilters';

const { width, height } = Dimensions.get('window');

const DEFAULT_GARMENT_TYPES: { id: string; label: string; price: number }[] = [
  { id: 'shirt', label: 'Shirt', price: 800 },
  { id: 'pants', label: 'Pants', price: 900 },
  { id: 'suit', label: 'Suit', price: 2500 },
  { id: 'dress', label: 'Dress', price: 1800 },
  { id: 'blazer', label: 'Blazer', price: 2000 },
  { id: 'barong', label: 'Barong', price: 3000 },
  { id: 'uniform', label: 'Uniform', price: 0 },
];

const DEFAULT_FABRIC_TYPES: { [key: string]: number } = {
  'Cotton': 200,
  'Silk': 300,
  'Linen': 400,
  'Wool': 200
};

type CustomGarmentEntry = {
  id: number;
  selectedGarment: string;
  selectedFabric: string;
  image: string | null;
};

export default function CustomizationService() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [garments, setGarments] = useState<CustomGarmentEntry[]>([
    { id: 1, selectedGarment: '', selectedFabric: '', image: null }
  ]);
  const [activeGarmentId, setActiveGarmentId] = useState(1);
  const [notes, setNotes] = useState('');
  const [preferredDate, setPreferredDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [garmentTypes, setGarmentTypes] = useState<{ id: string; label: string; price: number }[]>(DEFAULT_GARMENT_TYPES);
  const [loadingGarments, setLoadingGarments] = useState(false);

  const [fabricTypes, setFabricTypes] = useState<{ [key: string]: number }>(DEFAULT_FABRIC_TYPES);
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const [showFabricPicker, setShowFabricPicker] = useState(false);
  const [showGarmentPicker, setShowGarmentPicker] = useState(false);

  useEffect(() => {
    loadGarmentTypes();
    loadFabricTypes();
  }, []);

  useEffect(() => {
    const total = garments.reduce((sum, garment) => {
      if (!garment.selectedGarment || !garment.selectedFabric) return sum;
      const fabricPrice = fabricTypes[garment.selectedFabric] || 0;
      const selectedGarmentType = garmentTypes.find(g => g.id === garment.selectedGarment);
      const garmentPrice = selectedGarmentType?.price || 0;
      const isUniform = garment.selectedGarment.toLowerCase() === 'uniform';
      return sum + (isUniform ? 0 : fabricPrice + garmentPrice);
    }, 0);
    setEstimatedPrice(total);
  }, [garments, fabricTypes, garmentTypes]);

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
              price: parseFloat(garment.garment_price) || 0,
            }));

          const hasUniform = transformedGarments.some((g: any) => g.id.toLowerCase() === 'uniform');
          if (!hasUniform) {
            transformedGarments.push({ id: 'uniform', label: 'Uniform', price: 0 });
          }

          if (transformedGarments.length > 0) {
            setGarmentTypes(transformedGarments);
            console.log('✅ Loaded garment types for service:', transformedGarments);
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
          const fabricTypesObj: { [key: string]: number } = { ...DEFAULT_FABRIC_TYPES };
          data.fabrics.forEach((fabric: { fabric_name: string; fabric_price: string }) => {
            fabricTypesObj[fabric.fabric_name] = parseFloat(fabric.fabric_price);
          });
          setFabricTypes(fabricTypesObj);
        }
      }
    } catch (error) {
      console.log('Error loading fabric types:', error);

    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleDateConfirm = async (selectedDate: Date) => {
    setPreferredDate(selectedDate);
    setShowDatePicker(false);
    setSelectedTimeSlot('');

    await loadTimeSlotsForDate(selectedDate);
  };

  const loadTimeSlotsForDate = async (date: Date) => {
    console.log('[CustomizationService] loadTimeSlotsForDate called');
    setLoadingSlots(true);
    setSelectedTimeSlot('');
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      console.log('[CustomizationService] Loading time slots for date:', dateStr);
      const result = await appointmentSlotService.getAllSlotsWithAvailability('customization', dateStr);
      console.log('[CustomizationService] API Response:', result);
      if (result.success) {
        if (!result.isShopOpen) {
          setIsShopOpen(false);
          setTimeSlots([]);
          return;
        }
        setIsShopOpen(true);
        setTimeSlots(filterUserAllowedSlots(result.slots));
      } else {
        setTimeSlots([]);
      }
    } catch (error: any) {
      console.log('[CustomizationService] ERROR loading time slots:', error.message || error);
      setTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
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
      const nextUri = result.assets[0].uri;
      setGarments(prev =>
        prev.map(garment =>
          garment.id === activeGarmentId ? { ...garment, image: nextUri } : garment
        )
      );
    }
  };

  const activeGarment = garments.find(g => g.id === activeGarmentId) || garments[0];

  const addAnotherGarment = () => {
    setGarments(prev => {
      const nextId = prev.length ? Math.max(...prev.map(g => g.id)) + 1 : 1;
      setActiveGarmentId(nextId);
      return [...prev, { id: nextId, selectedGarment: '', selectedFabric: '', image: null }];
    });
  };

  const removeGarment = (id: number) => {
    setGarments(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(g => g.id !== id);
      if (activeGarmentId === id) {
        setActiveGarmentId(next[0].id);
      }
      return next;
    });
  };

  const handleOpen3DCustomizer = () => {
    router.push('/(tabs)/appointment/Customizer3D');
  };

  const resetCustomizationForm = () => {
    setGarments([{ id: 1, selectedGarment: '', selectedFabric: '', image: null }]);
    setActiveGarmentId(1);
    setNotes('');
    setPreferredDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setSelectedTimeSlot('');
    setTimeSlots([]);
    setShowFabricPicker(false);
    setShowGarmentPicker(false);
    setErrors({});
  };

  const handleAddToCart = async () => {
    const hasIncompleteGarment = garments.some(g => !g.selectedGarment || !g.selectedFabric);
    if (hasIncompleteGarment) {
      Alert.alert('Missing Information', 'Please select garment and fabric for all garments.');
      return;
    }
    if (!selectedTimeSlot) {
      Alert.alert('Missing Information', 'Please select a time slot');
      return;
    }

    setLoading(true);

    try {
      const garmentsPayload: Array<{
        fabricType: string;
        garmentType: string;
        imageUrl: string;
        estimatedPrice: number;
        isUniform: boolean;
        designData: Record<string, never>;
      }> = [];

      for (const garment of garments) {
        let imageUrl = 'no-image';
        if (garment.image) {
          try {
            const formData = new FormData();
            formData.append('customizationImage', {
              uri: garment.image,
              type: 'image/jpeg',
              name: `customization-${garment.id}.jpg`,
            } as any);

            const uploadResponse = await uploadCustomizationImage(formData);
            imageUrl = uploadResponse.imageUrl || uploadResponse.data?.imageUrl || 'no-image';
          } catch (uploadError) {
            console.log('Image upload failed for a garment, continuing without image');
          }
        }

        const garmentInfo = garmentTypes.find(g => g.id === garment.selectedGarment);
        const garmentLabel = garmentInfo?.label || garment.selectedGarment;
        const garmentPrice = garmentInfo?.price || 0;
        const fabricLabel = garment.selectedFabric;
        const fabricPrice = fabricTypes[fabricLabel] || 0;
        const isUniform = garment.selectedGarment.toLowerCase() === 'uniform';

        garmentsPayload.push({
          fabricType: fabricLabel,
          garmentType: garmentLabel,
          imageUrl,
          estimatedPrice: isUniform ? 0 : garmentPrice + fabricPrice,
          isUniform,
          designData: {},
        });
      }

      const year = preferredDate.getFullYear();
      const month = String(preferredDate.getMonth() + 1).padStart(2, '0');
      const day = String(preferredDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      try {
        const slotResult = await appointmentSlotService.bookSlot('customization', dateStr, selectedTimeSlot);
        if (!slotResult?.success) {
          throw new Error(slotResult?.message || 'Failed to book appointment slot.');
        }
        console.log('Slot booked successfully:', slotResult);
      } catch (slotError: any) {
        throw new Error(slotError.message || 'Failed to book appointment slot. Please try again.');
      }

      const primary = garmentsPayload[0];
      const totalEstimated = garmentsPayload.reduce((sum, g) => sum + (g.estimatedPrice || 0), 0);

      await addCustomizationToCart({
        garmentType: primary.garmentType,
        fabricType: primary.fabricType,
        preferredDate: dateStr,
        preferredTime: selectedTimeSlot,
        notes: notes,
        imageUrl: primary.imageUrl,
        estimatedPrice: totalEstimated,
        garments: garmentsPayload,
        isMultipleGarments: garmentsPayload.length > 1,
      });

      Alert.alert(
        'Success!',
        'Customization added to cart!',
        [
          {
            text: 'View Cart',
            onPress: () => {
              router.push('/cart/Cart');
            },
          },
          {
            text: 'Add Another Garment',
            onPress: resetCustomizationForm,
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
    <SafeAreaView style={styles.container}>
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

        <Text style={styles.sectionTitle}>Garments</Text>
        <View style={styles.garmentEntriesWrap}>
          {garments.map((garment, index) => {
            const garmentLabel = garmentTypes.find(g => g.id === garment.selectedGarment)?.label || 'Not set';
            const fabricLabel = garment.selectedFabric || 'Not set';
            const isActive = garment.id === activeGarmentId;

            return (
              <TouchableOpacity
                key={garment.id}
                style={[styles.garmentEntryCard, isActive && styles.garmentEntryCardActive]}
                onPress={() => setActiveGarmentId(garment.id)}
                activeOpacity={0.85}
              >
                <View style={styles.garmentEntryHeader}>
                  <Text style={styles.garmentEntryTitle}>Garment {index + 1}</Text>
                  {garments.length > 1 && (
                    <TouchableOpacity onPress={() => removeGarment(garment.id)}>
                      <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.garmentEntryText}>Type: {garmentLabel}</Text>
                <Text style={styles.garmentEntryText}>Fabric: {fabricLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.addAnotherBtn} onPress={addAnotherGarment} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color="#B8860B" />
          <Text style={styles.addAnotherBtnText}>Add Another Garment</Text>
        </TouchableOpacity>

        <Text style={styles.editingLabel}>Editing Garment {garments.findIndex(g => g.id === activeGarmentId) + 1}</Text>

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
                <Text style={[styles.dropdownText, !activeGarment?.selectedGarment && styles.dropdownPlaceholder]}>
                  {activeGarment?.selectedGarment ? garmentTypes.find(g => g.id === activeGarment.selectedGarment)?.label : 'Select a garment type'}
                </Text>
              </View>
              <View style={styles.dropdownRight}>
                {activeGarment?.selectedGarment && (
                  <Text style={styles.dropdownPrice}>
                    {activeGarment.selectedGarment === 'uniform' ? 'Price varies' : `₱${garmentTypes.find(g => g.id === activeGarment.selectedGarment)?.price?.toLocaleString() || 0}`}
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
                style={styles.modalOverlay}
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
                          activeGarment?.selectedGarment === garment.id && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setGarments(prev =>
                            prev.map(g =>
                              g.id === activeGarmentId ? { ...g, selectedGarment: garment.id } : g
                            )
                          );
                          setShowGarmentPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          activeGarment?.selectedGarment === garment.id && styles.pickerOptionTextSelected,
                        ]}>
                          {garment.label}
                        </Text>
                        <Text style={[
                          styles.pickerOptionPrice,
                          activeGarment?.selectedGarment === garment.id && styles.pickerOptionPriceSelected,
                        ]}>
                          {garment.id === 'uniform' ? 'Price varies' : `₱${garment.price.toLocaleString()}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
            {activeGarment?.selectedGarment === 'uniform' && (
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
            <TouchableOpacity
              style={styles.dropdownSelector}
              onPress={() => setShowFabricPicker(true)}
            >
              <View style={styles.dropdownLeft}>
                <MaterialCommunityIcons name="palette-swatch-outline" size={20} color="#8D6E63" />
                <Text style={[styles.dropdownText, !activeGarment?.selectedFabric && styles.dropdownPlaceholder]}>
                  {activeGarment?.selectedFabric || 'Select a fabric type'}
                </Text>
              </View>
              <View style={styles.dropdownRight}>
                {activeGarment?.selectedFabric && (
                  <Text style={styles.dropdownPrice}>₱{fabricTypes[activeGarment.selectedFabric]?.toLocaleString()}</Text>
                )}
                <Ionicons name="chevron-down" size={20} color="#8D6E63" />
              </View>
            </TouchableOpacity>
            <Modal
              visible={showFabricPicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowFabricPicker(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
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
                    {Object.entries(fabricTypes).map(([name, price]) => (
                      <TouchableOpacity
                        key={name}
                        style={[
                          styles.pickerOption,
                          activeGarment?.selectedFabric === name && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setGarments(prev =>
                            prev.map(g =>
                              g.id === activeGarmentId ? { ...g, selectedFabric: name } : g
                            )
                          );
                          setShowFabricPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          activeGarment?.selectedFabric === name && styles.pickerOptionTextSelected,
                        ]}>
                          {name}
                        </Text>
                        <Text style={[
                          styles.pickerOptionPrice,
                          activeGarment?.selectedFabric === name && styles.pickerOptionPriceSelected,
                        ]}>
                          ₱{price.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
            {activeGarment?.selectedGarment && activeGarment?.selectedFabric && (activeGarment.selectedGarment !== 'uniform') && (
              <View style={styles.priceEstimateCard}>
                <Text style={styles.priceEstimateTitle}>Estimated Price</Text>
                <View style={styles.priceBreakdown}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Garment ({garmentTypes.find(g => g.id === activeGarment.selectedGarment)?.label}):</Text>
                    <Text style={styles.priceValue}>₱{garmentTypes.find(g => g.id === activeGarment.selectedGarment)?.price?.toLocaleString()}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Fabric ({activeGarment.selectedFabric}):</Text>
                    <Text style={styles.priceValue}>₱{fabricTypes[activeGarment.selectedFabric]?.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.priceRow, styles.priceTotalRow]}>
                    <Text style={styles.priceTotalLabel}>Order Total:</Text>
                    <Text style={styles.priceTotalValue}>₱{estimatedPrice.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            )}
            <Text style={styles.sectionTitle}>Reference Image (Optional)</Text>
            <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
              {activeGarment?.image ? (
                <Image source={{ uri: activeGarment.image }} style={styles.previewImage} />
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
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.addToCartButton,
                (garments.some(g => !g.selectedGarment || !g.selectedFabric) || !selectedTimeSlot) && styles.buttonDisabled
              ]}
              onPress={handleAddToCart}
              disabled={loading || garments.some(g => !g.selectedGarment || !g.selectedFabric) || !selectedTimeSlot}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={20} color="#FFF" />
                  <Text style={styles.primaryButtonText}>Add {garments.length > 1 ? `${garments.length} Garments` : 'to Cart'}</Text>
                </>
              )}
            </TouchableOpacity>
      </ScrollView>
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

  garmentEntriesWrap: {
    gap: 10,
    marginBottom: 10,
  },
  garmentEntryCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    padding: 12,
  },
  garmentEntryCardActive: {
    borderColor: '#B8860B',
    backgroundColor: '#FFF8E7',
  },
  garmentEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  garmentEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5D4037',
  },
  garmentEntryText: {
    fontSize: 12,
    color: '#7c5f54',
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF8E7',
    borderColor: '#E6B764',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 14,
  },
  addAnotherBtnText: {
    color: '#8b5e00',
    fontWeight: '700',
    fontSize: 13,
  },
  editingLabel: {
    fontSize: 12,
    color: '#8D6E63',
    marginBottom: 4,
    fontWeight: '600',
  },

  garmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  garmentCard: {
    width: (width - 64) / 3,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8D5C4',
  },
  garmentCardSelected: {
    borderColor: '#B8860B',
    backgroundColor: '#FFF8E7',
  },
  garmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5D4037',
    marginTop: 6,
  },
  garmentLabelSelected: {
    color: '#B8860B',
  },
  garmentPrice: {
    fontSize: 11,
    color: '#8D6E63',
    marginTop: 2,
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
  summaryLabelTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5D4037',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4037',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B8860B',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E8D5C4',
    marginVertical: 10,
  },

  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8D5C4',
    borderRadius: 12,
    padding: 14,
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
    marginLeft: 10,
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  dropdownPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B8860B',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModal: {
    backgroundColor: '#FFFBF0',
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5C4',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D4037',
  },
  pickerScroll: {
    maxHeight: 350,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F0E8',
  },
  pickerOptionSelected: {
    backgroundColor: '#FFF8E7',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#5D4037',
  },
  pickerOptionTextSelected: {
    fontWeight: '600',
    color: '#B8860B',
  },
  pickerOptionPrice: {
    fontSize: 14,
    color: '#8D6E63',
  },
  pickerOptionPriceSelected: {
    fontWeight: '600',
    color: '#B8860B',
  },

  priceEstimateCard: {
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#B8860B',
  },
  priceEstimateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 12,
    textAlign: 'center',
  },
  priceBreakdown: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceTotalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8D5C4',
  },
  priceLabel: {
    fontSize: 14,
    color: '#8D6E63',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5D4037',
  },
  priceTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5D4037',
  },
  priceTotalValue: {
    fontSize: 18,
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
});

