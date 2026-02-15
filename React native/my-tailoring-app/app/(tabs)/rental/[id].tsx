
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { rentalService } from "../../../utils/rentalService";
import { cartService } from "../../../utils/apiService";

export default function RentalDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);

  const today = new Date();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [rentalDuration, setRentalDuration] = useState(3); 
  const [endDate, setEndDate] = useState<Date | null>(null); 
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false); 
  const [measurementUnit, setMeasurementUnit] = useState<'inch' | 'cm'>('inch');
  const [showMeasurements, setShowMeasurements] = useState(false);

  const getMeasurementValue = (measurement: any, unit: string): string | null => {
    if (!measurement) return null;

    if (typeof measurement === 'object' && measurement.inch !== undefined) {
      if (unit === 'inch') {
        return measurement.inch ? `${measurement.inch}"` : null;
      } else {
        return measurement.cm ? `${measurement.cm} cm` : null;
      }
    }

    if (typeof measurement === 'string' || typeof measurement === 'number') {
      const inchValue = String(measurement);
      if (unit === 'inch') {
        return `${inchValue}"`;
      } else {
        
        const num = parseFloat(inchValue);
        if (isNaN(num)) return null;
        return `${(num * 2.54).toFixed(1)} cm`;
      }
    }
    
    return null;
  };

  const getMeasurements = (): { label: string; value: string }[] => {
    if (!item || !item.size) return [];
    
    try {
      let measurements;
      let sizeString = item.size;
      
      if (typeof sizeString === 'string') {
        
        if (sizeString.startsWith('{') && !sizeString.endsWith('}')) {
          return [];
        }
        try {
          measurements = JSON.parse(sizeString);
        } catch (parseError) {
          return [];
        }
      } else {
        measurements = sizeString;
      }
      
      if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
        return [];
      }

      const parts: { label: string; value: string }[] = [];
      const checkValue = (val: any) => {
        if (typeof val === 'object' && val !== null) {
          return (val.inch && val.inch !== '' && val.inch !== '0') || 
                 (val.cm && val.cm !== '' && val.cm !== '0');
        }
        return val && val !== '' && val !== '0';
      };

      const measurementKeys = [
        { key: 'chest', label: 'Chest' },
        { key: 'shoulders', label: 'Shoulders' },
        { key: 'sleeveLength', label: 'Sleeve Length' },
        { key: 'neck', label: 'Neck' },
        { key: 'waist', label: 'Waist' },
        { key: 'length', label: 'Length' },
        { key: 'hips', label: 'Hips' },
        { key: 'inseam', label: 'Inseam' },
        { key: 'outseam', label: 'Outseam' },
        { key: 'thigh', label: 'Thigh' },
      ];

      measurementKeys.forEach(({ key, label }) => {
        if (checkValue(measurements[key])) {
          const value = getMeasurementValue(measurements[key], measurementUnit);
          if (value) parts.push({ label, value });
        }
      });

      return parts;
    } catch (e) {
      return [];
    }
  };

  const calculateEndDate = (start: Date | null, duration: number): Date | null => {
    if (!start) return null;
    const endDateObj = new Date(start);
    endDateObj.setDate(start.getDate() + duration - 1); 
    return endDateObj;
  };

  useEffect(() => {
    if (id) {
      fetchRentalDetails();
    }
  }, [id]);

  useEffect(() => {
    if (startDate && rentalDuration) {
      const calculatedEndDate = calculateEndDate(startDate, rentalDuration);
      setEndDate(calculatedEndDate);
    } else {
      setEndDate(null);
    }
  }, [startDate, rentalDuration]);

  const fetchRentalDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await rentalService.getRentalById(id as string);
      console.log('Rental details:', result);
      
      if (result.item) {
        setItem(result.item);
      } else {
        setError('Rental item not found');
      }
    } catch (err) {
      console.error('Error fetching rental:', err);
      setError('Failed to load rental details');
    } finally {
      setLoading(false);
    }
  };

  const getImageSource = () => {
    if (item?.image_url) {
      const imageUrl = rentalService.getImageUrl(item.image_url);
      if (imageUrl) {
        return { uri: imageUrl };
      }
    }
    return require("../../../assets/images/rent.jpg");
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "Not selected";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#94665B" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading rental details...</Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
        <Text style={{ marginTop: 12, color: '#EF4444', fontSize: 16 }}>{error || 'Item not found'}</Text>
        <TouchableOpacity 
          style={{ marginTop: 16, backgroundColor: '#94665B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => router.push('/rental')}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Back to Rentals</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const calculateTotalCost = (duration: number, rentalItem: any): number => {
    if (!duration || !rentalItem || duration < 3) return 0;

    const validDuration = Math.floor(duration / 3) * 3;
    if (validDuration < 3) return 0;

    let basePrice = 500; 
    if (rentalItem.price) {
      const priceStr = String(rentalItem.price).replace(/[^\d.]/g, ''); 
      const parsedPrice = parseFloat(priceStr);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        basePrice = parsedPrice;
      }
    } else if (rentalItem.daily_rate) {
      
      const dailyRate = parseFloat(rentalItem.daily_rate) || 0;
      basePrice = dailyRate * 3;
    }

    return (validDuration / 3) * basePrice;
  };

  const calculateTotal = () => {
    if (!startDate || !rentalDuration) return 0;
    return calculateTotalCost(rentalDuration, item);
  };

  const getMarkedDates = () => {
    const marked: any = {};
    if (tempStartDate) {
      marked[tempStartDate.toISOString().split("T")[0]] = {
        selected: true,
        selectedColor: "#94665B",
        textColor: "white",
      };
    }
    return marked;
  };

  const handleDayPress = (day: any) => {
    const selected = new Date(day.dateString);
    setTempStartDate(selected);
  };

  const applyStartDate = () => {
    if (tempStartDate) {
      setStartDate(tempStartDate);
      
    }
    setShowCalendar(false);
  };

  const handleAddToCart = () => {
    if (!startDate) {
      Alert.alert("Missing Date", "Please select a start date");
      return;
    }
    if (rentalDuration < 3) {
      Alert.alert("Invalid Duration", "Minimum rental period is 3 days");
      return;
    }
    if (rentalDuration > 30) {
      Alert.alert("Too Long", "Maximum rental period is 30 days");
      return;
    }
    if (rentalDuration % 3 !== 0) {
      Alert.alert("Invalid Duration", "Rental duration must be a multiple of 3 days (3, 6, 9, 12, etc.)");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmAddToCart = async () => {
    try {
      setAddingToCart(true);
      const totalPrice = calculateTotal();
      const calculatedEndDate = endDate || calculateEndDate(startDate, rentalDuration);

      if (!calculatedEndDate) {
        Alert.alert("Error", "Unable to calculate end date");
        return;
      }

      const rentalData = {
        serviceType: 'rental',
        serviceId: item.item_id,
        quantity: 1,
        basePrice: item.price || item.daily_rate * 3 || '0', 
        finalPrice: totalPrice.toString(),
        pricingFactors: {
          rental_duration: rentalDuration,
          base_price_per_3_days: item.price || item.daily_rate * 3 || '0',
          deposit_amount: item.deposit_amount || '0'
        },
        specificData: {
          item_name: item.item_name,
          brand: item.brand || '',
          size: item.size || '',
          category: item.category || '',
          image_url: item.image_url
        },
        rentalDates: {
          startDate: `${startDate!.getFullYear()}-${String(startDate!.getMonth() + 1).padStart(2, '0')}-${String(startDate!.getDate()).padStart(2, '0')}`,
          endDate: `${calculatedEndDate.getFullYear()}-${String(calculatedEndDate.getMonth() + 1).padStart(2, '0')}-${String(calculatedEndDate.getDate()).padStart(2, '0')}`
        }
      };

      const result = await cartService.addToCart(rentalData);
      
      if (result.success) {
        setShowConfirmModal(false);
        Alert.alert("Success!", "Rental added to cart!", [
          { text: "View Cart", onPress: () => router.push("/(tabs)/cart/Cart") },
          { text: "Continue", onPress: () => router.push("/rental") },
        ]);
      } else {
        Alert.alert("Error", result.message || "Failed to add to cart");
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      Alert.alert("Error", "Failed to add rental to cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/home")}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => setShowImageModal(true)}
          style={styles.imageContainer}
        >
          <Image source={getImageSource()} style={styles.image} resizeMode="cover" />
          <View style={styles.imageOverlay}>
            <Ionicons name="expand-outline" size={28} color="#fff" />
            <Text style={styles.tapToZoom}>Tap to zoom</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.sheet}>
          <LinearGradient
            colors={["#78350F", "#92400E"]}
            style={styles.titleBadge}
          >
            <Text style={styles.titleText}>{item.item_name}</Text>
          </LinearGradient>

          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Rental Price</Text>
            <Text style={styles.priceValue}>
              ₱{(() => {
                
                const basePrice = item.price || (item.daily_rate ? item.daily_rate * 3 : 0);
                return parseFloat(String(basePrice).replace(/[^\d.]/g, '') || "0").toLocaleString();
              })()}/3 days
            </Text>
          </View>
          <View style={styles.detailsGrid}>
            {[
              { key: "color", icon: "color-palette-outline", value: item.color },
              { key: "brand", icon: "business-outline", value: item.brand },
              { key: "material", icon: "shirt-outline", value: item.material },
            ].map((detail) => (
              <View key={detail.key} style={styles.detailItem}>
                <Ionicons
                  name={detail.icon as any}
                  size={20}
                  color="#94665B"
                />
                <Text style={styles.detailLabel}>
                  {detail.key.charAt(0).toUpperCase() + detail.key.slice(1)}
                </Text>
                <Text style={styles.detailValue}>{detail.value || "N/A"}</Text>
              </View>
            ))}
          </View>
          {getMeasurements().length > 0 && (
            <View style={styles.measurementsSection}>
              <View style={styles.measurementsHeader}>
                <TouchableOpacity
                  style={styles.measurementsToggleBtn}
                  onPress={() => setShowMeasurements(!showMeasurements)}
                >
                  <Ionicons name="resize-outline" size={18} color="#fff" />
                  <Text style={styles.measurementsToggleBtnText}>
                    {showMeasurements ? 'Hide Measurements' : 'Show Measurements'}
                  </Text>
                  <Ionicons 
                    name={showMeasurements ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="#fff" 
                  />
                </TouchableOpacity>
              </View>

              {showMeasurements && (
                <View style={styles.measurementsContent}>
                  <View style={styles.unitToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.unitToggleBtn,
                        measurementUnit === 'inch' && styles.unitToggleBtnActive
                      ]}
                      onPress={() => setMeasurementUnit('inch')}
                    >
                      <Text style={[
                        styles.unitToggleBtnText,
                        measurementUnit === 'inch' && styles.unitToggleBtnTextActive
                      ]}>Inch</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.unitToggleBtn,
                        measurementUnit === 'cm' && styles.unitToggleBtnActive
                      ]}
                      onPress={() => setMeasurementUnit('cm')}
                    >
                      <Text style={[
                        styles.unitToggleBtnText,
                        measurementUnit === 'cm' && styles.unitToggleBtnTextActive
                      ]}>CM</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.measurementsList}>
                    {getMeasurements().map((m, idx) => (
                      <View key={idx} style={styles.measurementRow}>
                        <Text style={styles.measurementLabel}>{m.label}</Text>
                        <Text style={styles.measurementValue}>{m.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this garment</Text>
            <Text style={styles.description}>
              {item.description || "Premium rental garment. Perfect for formal occasions."}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rental Period</Text>
            <TouchableOpacity
              style={styles.calendarBtn}
              onPress={() => {
                setTempStartDate(startDate);
                setShowCalendar(true);
              }}
            >
              <Ionicons name="calendar-outline" size={22} color="#94665B" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                {startDate ? (
                  <Text style={styles.dateText}>
                    Start: {formatDate(startDate)}
                  </Text>
                ) : (
                  <Text style={styles.placeholderText}>
                    Tap to select start date
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <View style={styles.durationContainer}>
              <Text style={styles.durationLabel}>Rental Duration *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={rentalDuration}
                  onValueChange={(value) => setRentalDuration(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="3 days" value={3} />
                  <Picker.Item label="6 days" value={6} />
                  <Picker.Item label="9 days" value={9} />
                  <Picker.Item label="12 days" value={12} />
                  <Picker.Item label="15 days" value={15} />
                  <Picker.Item label="18 days" value={18} />
                  <Picker.Item label="21 days" value={21} />
                  <Picker.Item label="24 days" value={24} />
                  <Picker.Item label="27 days" value={27} />
                  <Picker.Item label="30 days" value={30} />
                </Picker>
              </View>
            </View>
            {startDate && endDate && (
              <View style={styles.endDateContainer}>
                <Text style={styles.endDateLabel}>End Date (Auto-calculated)</Text>
                <Text style={styles.endDateValue}>{formatDate(endDate)}</Text>
              </View>
            )}
            {startDate && rentalDuration && (
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Cost</Text>
                <Text style={styles.totalValue}>
                  ₱{calculateTotal().toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart}>
            <LinearGradient
              colors={["#78350F", "#92400E"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Ionicons name="cart" size={24} color="#fff" />
            <Text style={styles.addBtnText}>ADD TO CART</Text>
          </TouchableOpacity>

          <View style={styles.policyCard}>
            <Text style={styles.policyTitle}>Rental Policy</Text>
            <View style={styles.policyRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.policyText}>
                Minimum 3 days • Maximum 30 days • Must be multiple of 3
              </Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              <Text style={styles.policyText}>Late return: ₱100 per day</Text>
            </View>
          </View>
        </View>
        <Modal visible={showCalendar} animationType="slide">
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={28} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>Select Start Date</Text>
              <TouchableOpacity
                onPress={applyStartDate}
                disabled={!tempStartDate}
              >
                <Text
                  style={[
                    styles.doneText,
                    !tempStartDate && { color: "#ccc" },
                  ]}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <Calendar
              minDate={today.toISOString().split("T")[0]}
              onDayPress={handleDayPress}
              markedDates={getMarkedDates()}
              theme={{
                selectedDayBackgroundColor: "#94665B",
                todayTextColor: "#94665B",
                arrowColor: "#94665B",
                monthTextColor: "#1F2937",
                textDayFontWeight: "600",
              }}
            />

            {tempStartDate && (
              <View style={styles.selectionSummary}>
                <Text style={styles.summaryText}>
                  Selected: {formatDate(tempStartDate)}
                </Text>
                <Text style={styles.summarySubtext}>
                  End date will be calculated based on duration
                </Text>
              </View>
            )}
          </View>
        </Modal>
        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIcon}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={48}
                  color="#94665B"
                />
              </View>
              <Text style={styles.modalTitle}>Confirm Rental</Text>
              <Text style={styles.modalValue}>{item.item_name}</Text>
              <Text style={styles.modalValue}>
                {formatDate(startDate)} → {formatDate(endDate)}
              </Text>
              <Text style={styles.modalValue}>
                {rentalDuration} day{rentalDuration > 1 ? "s" : ""}
              </Text>
              <View style={styles.costBreakdown}>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>
                    Base Price (per 3 days)
                  </Text>
                  <Text style={styles.costValue}>
                    ₱{(() => {
                      const basePrice = item.price || (item.daily_rate ? item.daily_rate * 3 : 0);
                      return parseFloat(String(basePrice).replace(/[^\d.]/g, '') || "0").toLocaleString();
                    })()}
                  </Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>
                    ({rentalDuration} days ÷ 3) × Base Price
                  </Text>
                  <Text style={styles.costValue}>
                    ₱{calculateTotal().toLocaleString()}
                  </Text>
                </View>
                <View style={styles.costDivider} />
              </View>

              <View style={styles.modalTotal}>
                <Text style={styles.modalTotalLabel}>Total</Text>
                <Text style={styles.modalTotalValue}>
                  ₱{calculateTotal().toLocaleString()}
                </Text>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={confirmAddToCart}
                >
                  <Text style={styles.modalConfirmText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal visible={showImageModal} transparent={true} animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowImageModal(false)}>
            <View style={styles.fullImageOverlay}>
              <View style={styles.fullImageHeader}>
                <TouchableOpacity
                  style={styles.closeImageBtn}
                  onPress={() => setShowImageModal(false)}
                >
                  <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
              </View>
              <Image
                source={getImageSource()}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  titleBadge: {
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: "#78350F",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  titleText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 380,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 0,
  },
  tapToZoom: {
    color: "#fff",
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sheet: {
    marginTop: -30,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  priceSection: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#FDF4F0",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#F5ECE3",
  },
  priceLabel: {
    fontSize: 15,
    color: "#78716C",
    marginBottom: 6,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.3,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#FDE68A",
    alignSelf: "flex-start",
  },
  priceValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#94665B",
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 28,
    gap: 12,
  },
  detailItem: {
    width: "48%",
    backgroundColor: "#FAFAFA",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  detailLabel: {
    fontSize: 12.5,
    color: "#78716C",
    marginTop: 10,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 6,
  },
  section: { marginTop: 36 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  description: { fontSize: 15.5, color: "#52525B", lineHeight: 24 },
  calendarBtn: {
    backgroundColor: "#FAFAFA",
    padding: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  dateText: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  daysText: { fontSize: 14, color: "#94665B", marginTop: 6, fontWeight: "600" },
  placeholderText: { fontSize: 15.5, color: "#9CA3AF", fontWeight: "500" },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FDF4F0",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F5ECE3",
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
  },
  totalValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#94665B",
  },
  addBtn: {
    marginTop: 36,
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 31,
    gap: 12,
    shadowColor: "#78350F",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 36,
    width: "92%",
    maxWidth: 420,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  modalIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FDF4F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1F2937",
    marginBottom: 28,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  costBreakdown: {
    width: "100%",
    marginVertical: 20,
    paddingVertical: 16,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  costLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  costValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  costDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  modalTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "#FAFAFA",
    padding: 24,
    borderRadius: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTotalLabel: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalTotalValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#94665B",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 16,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: "#94665B",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  calendarModal: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: Platform.OS === "ios" ? 50 : 20,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  calendarTitle: { fontSize: 19, fontWeight: "800", color: "#1F2937" },
  doneText: { fontSize: 17, fontWeight: "700", color: "#94665B" },
  selectionSummary: {
    padding: 24,
    backgroundColor: "#FDF4F0",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F5ECE3",
  },
  summaryText: { fontSize: 17, fontWeight: "700", color: "#94665B" },
  summarySubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
  },
  durationContainer: {
    marginTop: 16,
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    width: "100%",
  },
  endDateContainer: {
    marginTop: 16,
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  endDateLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
  },
  endDateValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImageHeader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 20,
    zIndex: 10,
  },
  closeImageBtn: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 30,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  policyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  policyText: { fontSize: 15, color: "#52525B", flex: 1 },
  policyCard: {
    marginTop: 36,
    backgroundColor: "#FAFAFA",
    padding: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  
  measurementsSection: {
    marginTop: 20,
  },
  measurementsHeader: {
    alignItems: 'center',
  },
  measurementsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B4513',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  measurementsToggleBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  measurementsContent: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  unitToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
    backgroundColor: '#f5f5f5',
    padding: 4,
    borderRadius: 20,
    alignSelf: 'center',
  },
  unitToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#666',
  },
  unitToggleBtnActive: {
    backgroundColor: '#2196F3',
  },
  unitToggleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  unitToggleBtnTextActive: {
    fontWeight: '700',
  },
  measurementsList: {
    gap: 8,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  measurementLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  measurementValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
  },
});