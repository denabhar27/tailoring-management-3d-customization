
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { rentalService } from "../../../utils/rentalService";
import { cartService } from "../../../utils/apiService";
import DateTimePickerModal from "../../../components/DateTimePickerModal";

const { width, height } = Dimensions.get("window");

export default function RentalLanding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleStartDate, setBundleStartDate] = useState<Date | null>(null);
  const [bundleDuration, setBundleDuration] = useState(3);
  const [bundleEndDate, setBundleEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    fetchRentals();
  }, []);

  const fetchRentals = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const result = await rentalService.getAvailableRentals();
      console.log('Rentals fetched:', result);

      if (result.items && result.items.length > 0) {
        setRentals(result.items);
      } else {
        setError('No rental items available');
      }
    } catch (err) {
      console.error('Error fetching rentals:', err);
      setError('Failed to load rental items');
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = () => {
    fetchRentals(true);
  };

  const getImageSource = (item: any) => {
    if (item.image_url) {
      const imageUrl = rentalService.getImageUrl(item.image_url);
      if (imageUrl) {
        return { uri: imageUrl };
      }
    }

    return require("../../../assets/images/rent.jpg");
  };

  const toggleItemSelection = (item: any) => {
    if (isMultiSelectMode) {
      setSelectedItems(prev => {
        const isSelected = prev.some(i => (i.item_id || i.id) === (item.item_id || item.id));
        if (isSelected) {
          return prev.filter(i => (i.item_id || i.id) !== (item.item_id || item.id));
        } else {
          return [...prev, item];
        }
      });
    } else {
      router.push(`/(tabs)/rental/${item.item_id}`);
    }
  };

  const isItemSelected = (item: any) => {
    return selectedItems.some(i => (i.item_id || i.id) === (item.item_id || item.id));
  };

  const calculateItemCost = (item: any, duration: number) => {
    if (!duration || duration < 3) return 0;
    const validDuration = Math.floor(duration / 3) * 3;
    if (validDuration < 3) return 0;
    const basePrice = parseFloat(item.daily_rate || item.price || '500');
    return (validDuration / 3) * basePrice;
  };

  const calculateBundleTotal = () => {
    if (!bundleStartDate || !bundleDuration || selectedItems.length === 0) return 0;
    return selectedItems.reduce((total, item) => total + calculateItemCost(item, bundleDuration), 0);
  };

  const calculateBundleDownpayment = () => {
    const totalCost = calculateBundleTotal();
    return totalCost * 0.5;
  };

  useEffect(() => {
    if (bundleStartDate && bundleDuration) {
      const endDate = new Date(bundleStartDate);
      endDate.setDate(endDate.getDate() + bundleDuration - 1);
      setBundleEndDate(endDate);
    } else {
      setBundleEndDate(null);
    }
  }, [bundleStartDate, bundleDuration]);

  const openBundleModal = () => {
    if (selectedItems.length === 0) {
      Alert.alert("No Items Selected", "Please select at least one item to rent");
      return;
    }
    setBundleStartDate(null);
    setBundleDuration(3);
    setBundleEndDate(null);
    setShowBundleModal(true);
  };

  const closeBundleModal = () => {
    setShowBundleModal(false);
    setBundleStartDate(null);
    setBundleDuration(3);
    setBundleEndDate(null);
  };

  const handleDateConfirm = (selectedDate: Date) => {
    setBundleStartDate(selectedDate);
    setShowDatePicker(false);
  };

  const handleAddBundleToCart = async () => {
    if (!bundleStartDate || !bundleDuration || selectedItems.length === 0) {
      Alert.alert("Missing Information", "Please select start date and rental duration");
      return;
    }

    setAddingToCart(true);
    try {
      const totalCost = calculateBundleTotal();
      const totalDownpayment = totalCost * 0.5;

      const bundleItems = selectedItems.map(item => ({
        id: item.item_id || item.id,
        item_name: item.item_name || item.name || 'Rental Item',
        brand: item.brand || 'Unknown',
        size: item.size || 'Standard',
        category: item.category || 'rental',
        downpayment: item.downpayment || 0,
        image_url: rentalService.getImageUrl(item.image_url),
        front_image: item.front_image ? rentalService.getImageUrl(item.front_image) : null,
        back_image: item.back_image ? rentalService.getImageUrl(item.back_image) : null,
        side_image: item.side_image ? rentalService.getImageUrl(item.side_image) : null,
        individual_cost: calculateItemCost(item, bundleDuration)
      }));

      const rentalData = {
        serviceType: 'rental',
        serviceId: bundleItems[0].id,
        quantity: selectedItems.length,
        basePrice: '0',
        finalPrice: totalCost.toString(),
        pricingFactors: {
          duration: bundleDuration,
          price: totalCost,
          downpayment: totalDownpayment.toString(),
          is_bundle: true,
          item_count: selectedItems.length
        },
        specificData: {
          is_bundle: true,
          bundle_items: bundleItems,
          item_names: bundleItems.map(i => i.item_name).join(', '),
          item_name: `Rental Bundle (${selectedItems.length} items)`,
          brand: 'Multiple',
          size: 'Various',
          category: 'rental_bundle',
          image_url: bundleItems[0]?.image_url || ''
        },
        rentalDates: {
          startDate: `${bundleStartDate.getFullYear()}-${String(bundleStartDate.getMonth() + 1).padStart(2, '0')}-${String(bundleStartDate.getDate()).padStart(2, '0')}`,
          endDate: `${bundleEndDate!.getFullYear()}-${String(bundleEndDate!.getMonth() + 1).padStart(2, '0')}-${String(bundleEndDate!.getDate()).padStart(2, '0')}`,
          duration: bundleDuration
        }
      };

      const result = await cartService.addToCart(rentalData);

      if (result.success) {
        Alert.alert("Success!", `${selectedItems.length} items added to cart as bundle!`, [
          { text: "View Cart", onPress: () => router.push("/(tabs)/cart/Cart") },
          { text: "Continue", onPress: () => {
            setSelectedItems([]);
            setIsMultiSelectMode(false);
            closeBundleModal();
          }},
        ]);
      } else {
        Alert.alert("Error", result.message || "Failed to add bundle to cart");
      }
    } catch (error: any) {
      console.error('Add bundle to cart error:', error);
      Alert.alert("Error", error.message || "Failed to add bundle to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerSection}>
          <View style={styles.greetingRow}>
            <Image
              source={require("../../../assets/images/logo.png")}
              style={styles.logo}
            />
            <View style={styles.brandInfo}>
              <Text style={styles.headerTitle}>Jackman Tailor Deluxe</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#78350F" />
          </TouchableOpacity>
        </View>
        <View style={styles.heroContainer}>
          <Image
            source={require("../../../assets/images/rent.jpg")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", "rgba(120,53,15,0.9)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBadge}>
            <Text style={styles.heroTitle}>Rent Premium Formal Wear</Text>
            <View style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Explore Collection</Text>
            </View>
          </View>
        </View>
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons name="shirt-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>All Rentals</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  if (isMultiSelectMode) {
                    setIsMultiSelectMode(false);
                    setSelectedItems([]);
                  } else {
                    setIsMultiSelectMode(true);
                  }
                }}
                style={[
                  styles.multiSelectButton,
                  isMultiSelectMode && styles.multiSelectButtonActive
                ]}
              >
                <Ionicons
                  name={isMultiSelectMode ? "close" : "checkbox-outline"}
                  size={18}
                  color={isMultiSelectMode ? "#fff" : "#78350F"}
                />
                <Text style={[
                  styles.multiSelectButtonText,
                  isMultiSelectMode && styles.multiSelectButtonTextActive
                ]}>
                  {isMultiSelectMode ? 'Cancel' : 'Select Multiple'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#94665B" />
            <Text style={styles.loadingText}>Loading rentals...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchRentals()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : rentals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shirt-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyText}>No rentals available</Text>
          </View>
        ) : (

          <View style={styles.rentalGrid}>
            {rentals.map((item) => {
              const selected = isItemSelected(item);
              return (
                <TouchableOpacity
                  key={item.item_id}
                  style={[
                    styles.rentalCard,
                    isMultiSelectMode && selected && styles.rentalCardSelected
                  ]}
                  activeOpacity={0.88}
                  onPress={() => toggleItemSelection(item)}
                >
                  {isMultiSelectMode && (
                    <View style={styles.selectionCheckbox}>
                      <View style={[
                        styles.checkbox,
                        selected && styles.checkboxChecked
                      ]}>
                        {selected && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                    </View>
                  )}

                  <View style={styles.imageWrapper}>
                    <Image
                      source={getImageSource(item)}
                      style={[
                        styles.rentalImage,
                        isMultiSelectMode && selected && styles.rentalImageSelected
                      ]}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.6)"]}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </View>
                  <View style={styles.rentalInfoOverlay}>
                    <Text style={styles.rentalTitle} numberOfLines={2}>
                      {item.item_name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.rentalPrice}>₱{parseFloat(item.price || 0).toLocaleString()}</Text>
                      <Text style={styles.priceLabel}>/3 days</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </View>
      </ScrollView>
      {isMultiSelectMode && selectedItems.length > 0 && (
        <View style={styles.bundleActionBar}>
          <View style={styles.bundleInfo}>
            <Text style={styles.bundleInfoText}>
              <Text style={styles.bundleCount}>{selectedItems.length}</Text> item{selectedItems.length > 1 ? 's' : ''} selected
            </Text>
            <Text style={styles.bundleDownpayment}>
              Est. Downpayment: ₱{calculateBundleDownpayment().toLocaleString()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bundleButton}
            onPress={openBundleModal}
          >
            <Text style={styles.bundleButtonText}>Set Dates & Add to Cart</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <Modal
        visible={showBundleModal}
        transparent
        animationType="slide"
        onRequestClose={closeBundleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bundleModalContent}>
            <View style={styles.bundleModalHeader}>
              <Text style={styles.bundleModalTitle}>
                Rental Bundle ({selectedItems.length} items)
              </Text>
              <TouchableOpacity onPress={closeBundleModal}>
                <Ionicons name="close" size={28} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.selectedItemsPreview}>
                <Text style={styles.selectedItemsTitle}>Selected Items:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedItemsScroll}>
                  {selectedItems.map((item, idx) => (
                    <View key={idx} style={styles.selectedItemChip}>
                      <Image
                        source={getImageSource(item)}
                        style={styles.selectedItemImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.selectedItemName} numberOfLines={1}>
                        {item.item_name || item.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleItemSelection(item)}
                        style={styles.removeItemButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.dateSection}>
                <Text style={styles.dateSectionTitle}>Rental Dates *</Text>

                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#78350F" />
                    <Text style={styles.dateInputText}>
                      {bundleStartDate
                        ? bundleStartDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Select start date"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateLabel}>Rental Duration</Text>
                  <View style={styles.durationSelector}>
                    {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30].map((days) => (
                      <TouchableOpacity
                        key={days}
                        style={[
                          styles.durationChip,
                          bundleDuration === days && styles.durationChipActive,
                        ]}
                        onPress={() => setBundleDuration(days)}
                      >
                        <Text
                          style={[
                            styles.durationChipText,
                            bundleDuration === days && styles.durationChipTextActive,
                          ]}
                        >
                          {days} days
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {bundleEndDate && (
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateLabel}>End Date (Auto-calculated)</Text>
                    <View style={[styles.dateInput, styles.dateInputDisabled]}>
                      <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
                      <Text style={[styles.dateInputText, styles.dateInputTextDisabled]}>
                        {bundleEndDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              {bundleStartDate && bundleDuration && (
                <View style={styles.costBreakdown}>
                  <Text style={styles.costBreakdownTitle}>Payment Summary</Text>

                  {selectedItems.map((item, idx) => {
                    const itemCost = calculateItemCost(item, bundleDuration);
                    return (
                      <View key={idx} style={styles.costItemRow}>
                        <Text style={styles.costItemName} numberOfLines={1}>
                          {item.item_name || item.name}
                        </Text>
                        <Text style={styles.costItemValue}>₱{itemCost.toFixed(2)}</Text>
                      </View>
                    );
                  })}

                  <View style={styles.costDivider} />

                  <View style={styles.costTotalRow}>
                    <Text style={styles.costTotalLabel}>Total Downpayment (Due Upon Pickup):</Text>
                  </View>
                  <View style={styles.costValueRow}>
                    <Text style={styles.costTotalValue}>
                      ₱{calculateBundleDownpayment().toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.costTotalRow}>
                    <Text style={styles.costTotalLabel}>Total Rental Cost (Due on Return):</Text>
                  </View>
                  <View style={styles.costValueRow}>
                    <Text style={styles.costTotalValue}>
                      ₱{calculateBundleTotal().toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.policyCard}>
                <Text style={styles.policyTitle}>Rental Policy</Text>
                <View style={styles.policyRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.policyText}>Minimum 3 days rental period</Text>
                </View>
                <View style={styles.policyRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.policyText}>Maximum 30 days rental period</Text>
                </View>
                <View style={styles.policyRow}>
                  <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                  <Text style={styles.policyText}>Late return: ₱100 per day</Text>
                </View>
              </View>
              <View style={styles.bundleModalActions}>
                <TouchableOpacity
                  style={styles.bundleCancelButton}
                  onPress={closeBundleModal}
                >
                  <Text style={styles.bundleCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.bundleSubmitButton,
                    (!bundleStartDate || !bundleDuration || addingToCart) && styles.bundleSubmitButtonDisabled
                  ]}
                  onPress={handleAddBundleToCart}
                  disabled={!bundleStartDate || !bundleDuration || addingToCart}
                >
                  <Text style={styles.bundleSubmitText}>
                    {addingToCart ? 'Adding...' : `Add Bundle - ₱${calculateBundleDownpayment().toLocaleString()}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <DateTimePickerModal
        visible={showDatePicker}
        mode="date"
        value={bundleStartDate || new Date()}
        minimumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
      />
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity onPress={() => router.replace("/home")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="home-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push("/(tabs)/appointment/appointmentSelection")
          }
        >
          <View style={styles.navItemWrap}>
            <Ionicons name="cut-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/faq")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/UserProfile/profile")}
        >
          <View style={styles.navItemWrap}>
            <Ionicons name="person-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF9" },

  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F4",
  },
  greetingRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 22 },
  brandInfo: { marginLeft: 12 },
  headerTitle: { fontWeight: "700", fontSize: 16, color: "#0F172A" },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  heroContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    height: height * 0.26,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 18,
  },
  heroImage: { width: "100%", height: "100%" },
  heroBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    marginBottom: 16,
  },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FDE68A",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  heroButtonText: { color: "#78350F", fontSize: 15, fontWeight: "700" },

  categorySection: { paddingVertical: 16, backgroundColor: "#FAFAF9" },
  categoryScroll: { paddingHorizontal: 20, gap: 14 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  categoryChipActive: {
    backgroundColor: "#78350F",
    borderColor: "#78350F",
  },
  categoryText: { fontSize: 15, fontWeight: "700", color: "#78350F" },
  categoryTextActive: { color: "#FFFFFF" },

  sectionContainer: { marginTop: 36, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  itemCount: { fontSize: 15, color: "#64748B", fontWeight: "600" },

  rentalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 30,
  },
  rentalCard: {
    width: (width - 52) / 2,
    height: 200,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  imageWrapper: { width: "100%", height: "100%" },
  rentalImage: { width: "100%", height: "100%" },
  rentalInfoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  rentalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 20,
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  rentalPrice: { fontSize: 20, fontWeight: "900", color: "#F59E0B" },
  priceLabel: { fontSize: 12, color: "#CBD5E1", fontWeight: "600" },

  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#94665B",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#9CA3AF",
  },

  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
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

  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#78350F',
  },
  multiSelectButtonActive: {
    backgroundColor: '#78350F',
    borderColor: '#78350F',
  },
  multiSelectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
  },
  multiSelectButtonTextActive: {
    color: '#FFFFFF',
  },
  selectionCheckbox: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  rentalCardSelected: {
    borderWidth: 3,
    borderColor: '#007bff',
  },
  rentalImageSelected: {
    opacity: 0.7,
  },

  bundleActionBar: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
    zIndex: 1000,
  },
  bundleInfo: {
    flex: 1,
  },
  bundleInfoText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bundleCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  bundleDownpayment: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 4,
  },
  bundleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  bundleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  bundleModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: height * 0.9,
    paddingBottom: 20,
  },
  bundleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bundleModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  selectedItemsPreview: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedItemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  selectedItemsScroll: {
    flexDirection: 'row',
  },
  selectedItemChip: {
    marginRight: 12,
    width: 100,
    alignItems: 'center',
  },
  selectedItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 6,
  },
  selectedItemName: {
    fontSize: 12,
    color: '#1F2937',
    textAlign: 'center',
    fontWeight: '500',
  },
  removeItemButton: {
    marginTop: 4,
  },
  dateSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dateSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  dateInputGroup: {
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  dateInputDisabled: {
    backgroundColor: '#F9FAFB',
  },
  dateInputText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  dateInputTextDisabled: {
    color: '#9CA3AF',
  },
  durationSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  durationChipActive: {
    backgroundColor: '#78350F',
    borderColor: '#78350F',
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
  },
  durationChipTextActive: {
    color: '#FFFFFF',
  },
  costBreakdown: {
    padding: 20,
    backgroundColor: '#F9FAFB',
    margin: 20,
    borderRadius: 16,
  },
  costBreakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  costWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFC107',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  costWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 16,
  },
  costItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  costItemName: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  costItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  costDivider: {
    height: 2,
    backgroundColor: '#1F2937',
    marginVertical: 12,
  },
  costTotalRow: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 2,
  },
  costValueRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  costTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  costTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#78350F',
  },
  bundleModalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  bundleCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  bundleCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  bundleSubmitButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  bundleSubmitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  bundleSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  policyCard: {
    marginTop: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#FAFAFA",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  policyText: {
    fontSize: 14,
    color: "#52525B",
    flex: 1
  },
});
