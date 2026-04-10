
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter , useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import { orderStore, Order } from "../../../utils/orderStore";
import { authService, orderTrackingService, notificationService, measurementsService, API_BASE_URL } from "../../../utils/apiService";

const { width, height } = Dimensions.get("window");

interface UserData {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface Measurements {
  top?: { [key: string]: string };
  bottom?: { [key: string]: string };
  notes?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<UserData>({
    first_name: "Loading...",
    middle_name: "",
    last_name: "",
    email: "Loading...",
    phone: "Loading...",
  });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedUser, setEditedUser] = useState<UserData>(user);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [measurementsExpanded, setMeasurementsExpanded] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [pendingPicture, setPendingPicture] = useState<{ uri: string; name: string; type: string } | null>(null);

  useEffect(() => {
    setOrders(orderStore.getOrders());

    const unsubscribe = orderStore.subscribe(() => {
      setOrders(orderStore.getOrders());
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchUserProfile();
    // Load stored profile picture
    const loadProfilePic = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed.profile_picture) {
            const picUrl = parsed.profile_picture.startsWith('http')
              ? parsed.profile_picture
              : `${API_BASE_URL.replace('/api', '')}${parsed.profile_picture}`;
            setProfilePicUri(picUrl);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    loadProfilePic();
  }, []);

  useEffect(() => {
    fetchOrderTracking();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchOrderTracking();
      fetchUnreadCount();
    }, [])
  );

  const fetchOrderTracking = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const result = await orderTrackingService.getUserOrderTracking();
      console.log("Orders fetched:", result);
      if (result.success) {

        const filteredOrders = result.data.map((order: any) => ({
          ...order,
          items: order.items.filter((item: any) =>
            item.status !== 'cancelled' &&
            item.status !== 'rejected' &&
            item.status !== 'price_declined'
          )
        })).filter((order: any) => order.items.length > 0);

        setOrders(filteredOrders);
        console.log("Filtered orders data:", filteredOrders);
      } else {
        setError(result.message || 'Failed to fetch orders');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Error loading orders');
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = () => {
    fetchOrderTracking(true);
    fetchUnreadCount();
  };

  const fetchUnreadCount = async () => {
    try {
      const result = await notificationService.getUnreadCount();
      if (result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch (error: any) {
      // Silently ignore session-expired errors (redirect is handled globally)
      if (error?.message?.includes('Session expired')) return;
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await authService.getProfile();
      if (response && response.user) {
        const userData = response.user;

        setUser({
          first_name: userData.first_name || "",
          middle_name: userData.middle_name || "",
          last_name: userData.last_name || "",
          email: userData.email || "",
          phone: userData.phone_number || "",
        });

        if (userData.profile_picture) {
          const picUrl = userData.profile_picture.startsWith('http')
            ? userData.profile_picture
            : `${API_BASE_URL.replace('/api', '')}${userData.profile_picture}`;
          setProfilePicUri(picUrl);
        }
      } else {

        setUser({
          first_name: "User",
          middle_name: "",
          last_name: "",
          email: "user@example.com",
          phone: "",
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      Alert.alert("Error", "Failed to load profile data");

      setUser({
        first_name: "User",
        middle_name: "",
        last_name: "",
        email: "user@example.com",
        phone: "",
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadgeClass = (status: string) => {
    const statusMap: any = {
      'pending': 'pending',
      'accepted': 'accepted',
      'price_confirmation': 'price-confirmation',
      'in_progress': 'in-progress',
      'ready_to_pickup': 'ready',
      'picked_up': 'picked-up',
      'rented': 'rented',
      'returned': 'returned',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'price_declined': 'cancelled'
    };
    return statusMap[status] || 'unknown';
  };

  const getStatusLabel = (status: string) => {
    const statusMap: any = {
      'pending': 'Pending',
      'accepted': 'Accepted',
      'price_confirmation': 'Price Confirmation',
      'in_progress': 'In Progress',
      'ready_to_pickup': 'Ready to Pickup',
      'picked_up': 'Picked Up',
      'rented': 'Rented',
      'returned': 'Returned',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'price_declined': 'Price Declined'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: any = {
      'pending': '#8B5CF6',
      'accepted': '#3B82F6',
      'price_confirmation': '#F59E0B',
      'in_progress': '#3B82F6',
      'ready_to_pickup': '#F59E0B',
      'picked_up': '#10B981',
      'rented': '#10B981',
      'returned': '#10B981',
      'completed': '#10B981',
      'cancelled': '#EF4444',
      'price_declined': '#EF4444'
    };
    return colorMap[status] || '#6B7280';
  };

  const getStatusDotClass = (currentStatus: string, stepStatus: string, serviceType: string | null = null) => {

    const rentalFlow = ['pending', 'ready_to_pickup', 'ready_for_pickup', 'rented', 'returned', 'completed'];

    const defaultFlow = ['pending', 'price_confirmation', 'accepted', 'in_progress', 'ready_to_pickup', 'completed'];

    const statusFlow = serviceType === 'rental' ? rentalFlow : defaultFlow;

    const normalizedCurrent = currentStatus === 'ready_for_pickup' ? 'ready_to_pickup' : currentStatus;
    const normalizedStep = stepStatus === 'ready_for_pickup' ? 'ready_to_pickup' : stepStatus;

    const currentIndex = statusFlow.indexOf(normalizedCurrent);
    const stepIndex = statusFlow.indexOf(normalizedStep);

    if (currentIndex >= stepIndex) {
      return 'completed';
    } else {
      return 'pending';
    }
  };

  const getTimelineItemClass = (currentStatus: string, stepStatus: string, serviceType: string | null = null) => {

    const rentalFlow = ['pending', 'ready_to_pickup', 'ready_for_pickup', 'rented', 'returned', 'completed'];

    const defaultFlow = ['pending', 'price_confirmation', 'accepted', 'in_progress', 'ready_to_pickup', 'completed'];

    const statusFlow = serviceType === 'rental' ? rentalFlow : defaultFlow;

    const normalizedCurrent = currentStatus === 'ready_for_pickup' ? 'ready_to_pickup' : currentStatus;
    const normalizedStep = stepStatus === 'ready_for_pickup' ? 'ready_to_pickup' : stepStatus;

    const currentIndex = statusFlow.indexOf(normalizedCurrent);
    const stepIndex = statusFlow.indexOf(normalizedStep);

    return currentIndex >= stepIndex ? 'completed' : '';
  };

  const shouldShowTimelineDate = (currentStatus: string, stepStatus: string, serviceType: string | null = null) => {
    const rentalFlow = ['pending', 'ready_to_pickup', 'ready_for_pickup', 'rented', 'returned', 'completed'];
    const defaultFlow = ['pending', 'price_confirmation', 'accepted', 'in_progress', 'ready_to_pickup', 'completed'];
    const statusFlow = serviceType === 'rental' ? rentalFlow : defaultFlow;

    const normalizedCurrent = currentStatus === 'ready_for_pickup' ? 'ready_to_pickup' : currentStatus;
    const normalizedStep = stepStatus === 'ready_for_pickup' ? 'ready_to_pickup' : stepStatus;

    const currentIndex = statusFlow.indexOf(normalizedCurrent);
    const stepIndex = statusFlow.indexOf(normalizedStep);

    return currentIndex >= stepIndex;
  };

  const getEstimatedPrice = (specificData: any, serviceType: string) => {
    if (serviceType === 'repair') {

      if (specificData?.estimatedPrice) {
        return specificData.estimatedPrice;
      }

      const damageLevel = specificData?.damageLevel;
      const prices: any = {
        'minor': 300,
        'moderate': 500,
        'major': 800,
        'severe': 1200
      };
      return prices[damageLevel] || 0;
    } else if (serviceType === 'dry_cleaning') {

      // Check if there are garments with isEstimated flag
      if (specificData?.garments && Array.isArray(specificData.garments)) {
        const hasEstimatedGarment = specificData.garments.some((g: any) => g.isEstimated === true);
        if (hasEstimatedGarment) {
          let total = 0;
          specificData.garments.forEach((g: any) => {
            const price = g.isEstimated ? 350 : (g.pricePerItem || 200);
            const qty = g.quantity || 1;
            total += price * qty;
          });
          return total;
        }
      }

      const serviceName = specificData?.serviceName || '';
      const quantity = specificData?.quantity || 1;

      const basePrices: any = {
        'Basic Dry Cleaning': 200,
        'Premium Dry Cleaning': 350,
        'Delicate Items': 450,
        'Express Service': 500
      };

      const pricePerItem: any = {
        'Basic Dry Cleaning': 150,
        'Premium Dry Cleaning': 250,
        'Delicate Items': 350,
        'Express Service': 400
      };

      const basePrice = basePrices[serviceName] || 200;
      const perItemPrice = pricePerItem[serviceName] || 150;

      return basePrice + (perItemPrice * quantity);
    }
    return 0;
  };

  const hasPriceChanged = (specificData: any, finalPrice: number, serviceType: string) => {

    if (specificData?.adminPriceUpdated === true) {
      return true;
    }

    const estimatedPrice = getEstimatedPrice(specificData, serviceType);

    if (estimatedPrice > 0 && specificData?.adminNotes) {
      const difference = Math.abs(finalPrice - estimatedPrice);
      return difference > 0.01;
    }

    return false;
  };

  const shouldShowPriceConfirmation = (item: any) => {
    const isPriceConfirmationStatus = item.status === 'price_confirmation';
    const priceChanged = hasPriceChanged(item.specific_data, parseFloat(item.final_price), item.service_type);

    return isPriceConfirmationStatus && priceChanged;
  };

  const handleAcceptPrice = async (item: any) => {
    try {
      const response = await orderTrackingService.acceptPrice(item.order_item_id);

      if (response.success) {
        Alert.alert('Success', 'Price accepted! Your order is now accepted.');

        fetchOrderTracking();
      } else {
        Alert.alert('Error', response.message || 'Failed to accept price');
        console.error('Failed to accept price:', response);
      }
    } catch (error) {
      Alert.alert('Error', 'Error accepting price. Please try again.');
      console.error('Error accepting price:', error);
    }
  };

  const handleDeclinePrice = async (item: any) => {
    try {
      const response = await orderTrackingService.declinePrice(item.order_item_id);

      if (response.success) {
        Alert.alert('Success', 'Price declined. Your order has been cancelled.');

        fetchOrderTracking();
      } else {
        Alert.alert('Error', response.message || 'Failed to decline price');
        console.error('Failed to decline price:', response);
      }
    } catch (error) {
      Alert.alert('Error', 'Error declining price. Please try again.');
      console.error('Error declining price:', error);
    }
  };

  const pickProfilePicture = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS === 'ios',
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const fileName = uri.split('/').pop() || 'profile.jpg';
    const match = /\.(\w+)$/.exec(fileName);
    const fileType = match ? `image/${match[1]}` : 'image/jpeg';

    // Store selected picture for preview, upload only on Save Changes
    setPendingPicture({ uri, name: fileName, type: fileType });
  };

  const uploadPendingPicture = async (): Promise<boolean> => {
    if (!pendingPicture) return true;

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', {
        uri: pendingPicture.uri,
        name: pendingPicture.name,
        type: pendingPicture.type,
      } as any);

      const data = await authService.updateProfilePicture(formData);

      if (data.success && data.user) {
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        if (data.user.profile_picture) {
          const picUrl = data.user.profile_picture.startsWith('http')
            ? data.user.profile_picture
            : `${API_BASE_URL.replace('/api', '')}${data.user.profile_picture}`;
          setProfilePicUri(picUrl);
        }
        setPendingPicture(null);
        return true;
      } else {
        Alert.alert('Error', data.message || 'Failed to upload picture');
        return false;
      }
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', error?.message || 'Failed to upload picture. Please try again.');
      return false;
    } finally {
      setUploadingPic(false);
    }
  };

  const openEditModal = () => {
    setEditedUser(user);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditedUser(user);
    setPendingPicture(null);
  };

  const saveProfile = async () => {
    if (!editedUser.first_name.trim() || !editedUser.last_name.trim()) {
      alert("First name and last name are required");
      return;
    }
    if (!editedUser.email.trim()) {
      alert("Email cannot be empty");
      return;
    }
    if (!editedUser.phone.trim()) {
      alert("Phone cannot be empty");
      return;
    }

    if (editedUser.phone.replace(/\D/g, '').length !== 11) {
      alert("Phone number must be exactly 11 digits");
      return;
    }

    const hasProfileChanges = !(
      editedUser.first_name.trim() === user.first_name.trim() &&
      editedUser.middle_name.trim() === user.middle_name.trim() &&
      editedUser.last_name.trim() === user.last_name.trim() &&
      editedUser.email.trim() === user.email.trim() &&
      editedUser.phone.trim() === user.phone.trim()
    );
    const hasPictureChange = !!pendingPicture;

    // Check if any changes were made before saving
    if (!hasProfileChanges && !hasPictureChange) {
      setEditModalVisible(false);
      return;
    }

    try {
      // Upload pending picture if any
      if (hasPictureChange) {
        const picSuccess = await uploadPendingPicture();
        if (!picSuccess) return;
      }

      // Update profile info if changed
      if (hasProfileChanges) {
        const updateData = {
          first_name: editedUser.first_name.trim(),
          middle_name: editedUser.middle_name.trim() || null,
          last_name: editedUser.last_name.trim(),
          email: editedUser.email,
          phone_number: editedUser.phone.replace(/\D/g, '')
        };

        const response = await authService.updateProfile(updateData);

        if (response.success) {
          const updatedUser = {
            ...editedUser,
            phone: editedUser.phone.replace(/\D/g, '')
          };
          setUser(updatedUser);
          await AsyncStorage.setItem('userData', JSON.stringify(response.user || updatedUser));
        } else {
          alert(response.message || "Failed to update profile");
          return;
        }
      }

      setEditModalVisible(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: height * 0.12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#94665B"]}
            tintColor="#94665B"
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("../home")}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="#000" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {profilePicUri ? (
                <Image
                  source={{ uri: profilePicUri }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                />
              ) : (
                <Ionicons name="person" size={50} color="#94665B" />
              )}
            </View>
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={pickProfilePicture}
              disabled={uploadingPic}
            >
              {uploadingPic ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{`${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.replace(/\s+/g, ' ').trim() || 'User'}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>

          <View style={styles.profileButtonsRow}>
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={openEditModal}
            >
              <Ionicons name="pencil" size={16} color="#94665B" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.measurementsDropdownHeader}
            onPress={async () => {
              const newExpanded = !measurementsExpanded;
              setMeasurementsExpanded(newExpanded);

              if (newExpanded && !measurements && !loadingMeasurements) {
                setLoadingMeasurements(true);
                try {
                  const result = await measurementsService.getMyMeasurements();
                  console.log('Measurements API result:', result);
                  if (result.success && result.measurements) {
                    setMeasurements(result.measurements);
                  } else if (result.data && result.data.measurements) {
                    setMeasurements(result.data.measurements);
                  } else if (result.top || result.bottom) {
                    setMeasurements(result);
                  } else {
                    setMeasurements(null);
                  }
                } catch (error) {
                  console.error('Error fetching measurements:', error);
                  setMeasurements(null);
                }
                setLoadingMeasurements(false);
              }
            }}
          >
            <View style={styles.measurementsDropdownLeft}>
              <Ionicons name="resize-outline" size={22} color="#94665B" />
              <Text style={styles.measurementsDropdownTitle}>My Measurements</Text>
            </View>
            <Ionicons
              name={measurementsExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color="#94665B"
            />
          </TouchableOpacity>
          {measurementsExpanded && (
            <View style={styles.measurementsDropdownContent}>
              {loadingMeasurements ? (
                <View style={styles.measurementsLoadingContainer}>
                  <ActivityIndicator size="small" color="#94665B" />
                  <Text style={styles.measurementsLoadingText}>Loading measurements...</Text>
                </View>
              ) : measurements ? (
                <View style={styles.measurementsContent}>
                  {measurements.top && Object.keys(measurements.top).length > 0 && (
                    <View style={styles.measurementSection}>
                      <Text style={styles.measurementSectionTitle}>Top Measurements</Text>
                      <View style={styles.measurementTable}>
                        <View style={styles.measurementTableHeader}>
                          <Text style={styles.measurementHeaderText}>Measurement</Text>
                          <Text style={styles.measurementHeaderText}>Value (inches)</Text>
                        </View>
                        {Object.entries(measurements.top).map(([key, value], idx) => {
                          if (!value || value === '' || value === '0') return null;
                          const labelMap: { [key: string]: string } = {
                            'chest': 'Chest',
                            'shoulders': 'Shoulders',
                            'sleeveLength': 'Sleeve Length',
                            'neck': 'Neck',
                            'waist': 'Waist',
                            'length': 'Length'
                          };
                          const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
                          return (
                            <View key={idx} style={[styles.measurementRow, idx % 2 === 0 ? styles.measurementRowEven : styles.measurementRowOdd]}>
                              <Text style={styles.measurementLabel}>{label}</Text>
                              <Text style={styles.measurementValue}>{value}&quot;</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {measurements.bottom && Object.keys(measurements.bottom).length > 0 && (
                    <View style={styles.measurementSection}>
                      <Text style={styles.measurementSectionTitle}>Bottom Measurements</Text>
                      <View style={styles.measurementTable}>
                        <View style={styles.measurementTableHeader}>
                          <Text style={styles.measurementHeaderText}>Measurement</Text>
                          <Text style={styles.measurementHeaderText}>Value (inches)</Text>
                        </View>
                        {Object.entries(measurements.bottom).map(([key, value], idx) => {
                          if (!value || value === '' || value === '0') return null;
                          const labelMap: { [key: string]: string } = {
                            'waist': 'Waist',
                            'hips': 'Hips',
                            'inseam': 'Inseam',
                            'length': 'Length',
                            'thigh': 'Thigh',
                            'outseam': 'Outseam'
                          };
                          const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
                          return (
                            <View key={idx} style={[styles.measurementRow, idx % 2 === 0 ? styles.measurementRowEven : styles.measurementRowOdd]}>
                              <Text style={styles.measurementLabel}>{label}</Text>
                              <Text style={styles.measurementValue}>{value}&quot;</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {measurements.notes && (
                    <View style={styles.measurementNotesContainer}>
                      <Text style={styles.measurementNotesTitle}>Notes:</Text>
                      <Text style={styles.measurementNotesText}>{measurements.notes}</Text>
                    </View>
                  )}

                  {(!measurements.top || Object.keys(measurements.top).length === 0) &&
                   (!measurements.bottom || Object.keys(measurements.bottom).length === 0) && (
                    <View style={styles.noMeasurementsContainer}>
                      <Ionicons name="body-outline" size={40} color="#D1D5DB" />
                      <Text style={styles.noMeasurementsText}>
                        No measurements recorded yet.
                      </Text>
                      <Text style={styles.noMeasurementsSubtext}>
                        Contact admin to add your measurements.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.noMeasurementsContainer}>
                  <Ionicons name="body-outline" size={40} color="#D1D5DB" />
                  <Text style={styles.noMeasurementsText}>
                    No measurements recorded yet.
                  </Text>
                  <Text style={styles.noMeasurementsSubtext}>
                    Contact admin to add your measurements.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#94665B" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Order Tracking</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/orders/OrderHistory")}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#94665B" />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : !orders || orders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Ionicons name="receipt-outline" size={60} color="#D1D5DB" />
              <Text style={styles.emptyOrdersText}>No orders found</Text>
              <Text style={styles.emptyOrdersSubtext}>
                Book a service to see your orders here
              </Text>
            </View>
          ) : (
            <View style={styles.orderCards}>
              {(orders || []).flatMap((order: any) => {
                if (!order || !Array.isArray(order.items)) {
                  return [];
                }
                return order.items.map((item: any) => {
                  const estimatedPrice = getEstimatedPrice(item.specific_data, item.service_type);
                  const priceChanged = hasPriceChanged(item.specific_data, parseFloat(item.final_price), item.service_type);

                  const isUniform = (item.service_type === 'customize' || item.service_type === 'customization') && (
                    item.specific_data?.garmentType?.toLowerCase() === 'uniform' ||
                    item.specific_data?.isUniform === true ||
                    item.pricing_factors?.isUniform === true
                  );
                  const finalPrice = parseFloat(item.final_price);

                  return (
                    <View key={`${item.order_id}-${item.order_item_id}`} style={styles.orderCard}>
                      <View style={styles.orderHeader}>
                        <View style={styles.orderInfo}>
                          <Text style={styles.orderNo}>
                            Parent Order #{item.parent_order_id || item.order_id}
                          </Text>
                          <Text style={styles.orderNo}>
                            Child Order #{item.child_order_id || item.order_item_id}
                          </Text>
                          <Text style={styles.orderNo}>
                            {item.service_type === 'dry_cleaning' ? 'Dry Cleaning' : item.service_type.charAt(0).toUpperCase() + item.service_type.slice(1)} Service
                          </Text>
                        </View>
                        <View style={styles.orderPriceContainer}>
                          {isUniform && finalPrice === 0 ? (
                            <Text style={[styles.orderPrice, { color: '#e65100' }]}>Price varies</Text>
                          ) : isUniform && finalPrice > 0 ? (
                            <Text style={[styles.orderPrice, { color: '#4caf50' }]}>₱{finalPrice.toFixed(2)}</Text>
                          ) : (
                            <Text style={styles.orderPrice}>₱{finalPrice.toFixed(2)}</Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.orderStatus}>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: getStatusColor(item.status) + "20" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              { color: getStatusColor(item.status) },
                            ]}
                          >
                            {getStatusLabel(item.status)}
                          </Text>
                        </View>
                      </View>
                      {(estimatedPrice > 0 || parseFloat(item.final_price) > 0) && (
                        <View style={styles.priceComparison}>
                          {estimatedPrice > 0 ? (
                            <>
                              <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Estimated Price:</Text>
                                <Text style={styles.priceValueEstimated}>₱{estimatedPrice.toFixed(2)}</Text>
                              </View>
                              <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Final Price:</Text>
                                <Text style={[styles.priceValueFinal, priceChanged ? styles.priceChanged : styles.priceSame]}>
                                  ₱{parseFloat(item.final_price).toFixed(2)}
                                  {priceChanged && item.status === 'price_confirmation' && (
                                    <Text style={styles.priceChangeIndicator}> ⚠️ Updated by Admin</Text>
                                  )}
                                </Text>
                              </View>
                            </>
                          ) : (
                            <View style={styles.priceRow}>
                              <Text style={styles.priceLabel}>Final Price:</Text>
                              <Text style={styles.priceValueFinal}>₱{parseFloat(item.final_price).toFixed(2)}</Text>
                            </View>
                          )}
                          {priceChanged && item.status === 'price_confirmation' && item.specific_data?.adminNotes && (
                            <View style={styles.adminNotes}>
                              <Text style={styles.notesLabel}>Admin Note:</Text>
                              <Text style={styles.notesText}>{item.specific_data.adminNotes}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      <View style={styles.orderTimeline}>
                        <View style={styles.timelineContainer}>
                          {item.service_type === 'rental' ? (
                            <>
                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'pending', 'rental') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'pending', 'rental') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Order Placed</Text>
                                  <Text style={styles.timelineDate}>{formatDate(order.order_date)}</Text>
                                </View>
                              </View>

                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'ready_to_pickup', 'rental') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'ready_to_pickup', 'rental') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Ready to Pick Up</Text>
                                  <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'ready_to_pickup', 'rental') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                </View>
                              </View>

                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'rented', 'rental') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'rented', 'rental') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Rented</Text>
                                  <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'rented', 'rental') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                </View>
                              </View>

                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'returned', 'rental') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'returned', 'rental') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Returned</Text>
                                  <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'returned', 'rental') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                </View>
                              </View>

                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'completed', 'rental') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'completed', 'rental') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Completed</Text>
                                  <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'completed', 'rental') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                </View>
                              </View>
                            </>
                          ) : (
                            <>
                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'pending') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'pending') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Order Placed</Text>
                                  <Text style={styles.timelineDate}>{formatDate(order.order_date)}</Text>
                                </View>
                              </View>
                              {item.status === 'price_confirmation' && (
                                <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'price_confirmation') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                  <View style={[styles.timelineDot, getStatusDotClass(item.status, 'price_confirmation') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                  <View style={styles.timelineContent}>
                                    <Text style={styles.timelineTitle}>Price Confirmation</Text>
                                    <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'price_confirmation') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                  </View>
                                </View>
                              )}
                              {item.status === 'accepted' && (
                                <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'accepted') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                  <View style={[styles.timelineDot, getStatusDotClass(item.status, 'accepted') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                  <View style={styles.timelineContent}>
                                    <Text style={styles.timelineTitle}>Accepted</Text>
                                    <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'accepted') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                  </View>
                                </View>
                              )}

                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'in_progress') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'in_progress') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>In Progress</Text>
                                  <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'in_progress') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                </View>
                              </View>

                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'ready_to_pickup') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'ready_to_pickup') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Ready to Pick Up</Text>
                                  <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'ready_to_pickup') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                </View>
                              </View>

                              <View style={[styles.timelineItem, getTimelineItemClass(item.status, 'completed') === 'completed' ? styles.timelineItemCompleted : {}]}>
                                <View style={[styles.timelineDot, getStatusDotClass(item.status, 'completed') === 'completed' ? styles.timelineDotCompleted : styles.timelineDotPending]} />
                                <View style={styles.timelineContent}>
                                  <Text style={styles.timelineTitle}>Completed</Text>
                                  <Text style={styles.timelineDate}>{shouldShowTimelineDate(item.status, 'completed') ? formatDate(item.status_updated_at) : 'Pending'}</Text>
                                </View>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                      {shouldShowPriceConfirmation(item) && (
                        <View style={styles.priceConfirmationActions}>
                          <View style={styles.confirmationMessage}>
                            <Text style={styles.confirmationTitle}>Price Update Required</Text>
                            <Text style={styles.confirmationText}>Please review the updated pricing and confirm to proceed.</Text>
                          </View>
                          <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.btnAcceptPrice} onPress={() => handleAcceptPrice(item)}>
                              <Text style={styles.btnAcceptPriceText}>Accept Price - Continue</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnDeclinePrice} onPress={() => handleDeclinePrice(item)}>
                              <Text style={styles.btnDeclinePriceText}>Decline Price</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      <View style={styles.orderFooter}>
                        <View style={styles.orderDates}>
                          <Text style={styles.dateInfo}>Requested: {formatDate(order.order_date)}</Text>
                          <Text style={styles.dateInfo}>Updated: {formatDate(item.status_updated_at)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.viewDetailsBtn}
                          onPress={() => router.push(`/orders/${item.order_item_id}`)}
                        >
                          <Text style={styles.viewDetailsText}>View Details</Text>
                          <Ionicons name="chevron-forward" size={16} color="#94665B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                });
              })}
            </View>
          )}
        </View>
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, { borderBottomWidth: 0 }]}
            onPress={async () => {
              // Clear all auth data
              await AsyncStorage.removeItem('userToken');
              await AsyncStorage.removeItem('userRole');
              await AsyncStorage.removeItem('userData');
              router.replace("/");
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={[styles.actionText, { color: "#EF4444" }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeEditModal}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContent}>
              {/* Drag handle indicator */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
              </View>

              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeEditModal} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <View style={styles.modalAvatarSection}>
                  <View style={styles.modalAvatar}>
                    {pendingPicture ? (
                      <Image
                        source={{ uri: pendingPicture.uri }}
                        style={{ width: 100, height: 100, borderRadius: 50 }}
                      />
                    ) : profilePicUri ? (
                      <Image
                        source={{ uri: profilePicUri }}
                        style={{ width: 100, height: 100, borderRadius: 50 }}
                      />
                    ) : (
                      <Ionicons name="person" size={50} color="#94665B" />
                    )}
                    {/* Camera overlay badge */}
                    <TouchableOpacity
                      onPress={pickProfilePicture}
                      disabled={uploadingPic}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: '#94665B',
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: '#fff',
                      }}
                    >
                      {uploadingPic ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="camera" size={16} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 8 }}>
                    {pendingPicture ? 'New photo selected' : 'Tap camera icon to change'}
                  </Text>
                </View>
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>
                    Personal Information
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>First Name *</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#94665B"
                      />
                      <TextInput
                        style={styles.input}
                        value={editedUser.first_name}
                        onChangeText={(text) =>
                          setEditedUser({ ...editedUser, first_name: text })
                        }
                        placeholder="Enter your first name"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Middle Name (Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#94665B"
                      />
                      <TextInput
                        style={styles.input}
                        value={editedUser.middle_name}
                        onChangeText={(text) =>
                          setEditedUser({ ...editedUser, middle_name: text })
                        }
                        placeholder="Enter your middle name"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Last Name *</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#94665B"
                      />
                      <TextInput
                        style={styles.input}
                        value={editedUser.last_name}
                        onChangeText={(text) =>
                          setEditedUser({ ...editedUser, last_name: text })
                        }
                        placeholder="Enter your last name"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address *</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="mail-outline" size={20} color="#94665B" />
                      <TextInput
                        style={styles.input}
                        value={editedUser.email}
                        onChangeText={(text) =>
                          setEditedUser({ ...editedUser, email: text })
                        }
                        placeholder="Enter your email"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>
                    Contact Information
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number *</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="call-outline" size={20} color="#94665B" />
                      <TextInput
                        style={styles.input}
                        value={editedUser.phone}
                        onChangeText={(text) =>
                          setEditedUser({ ...editedUser, phone: text.replace(/\D/g, '') })
                        }
                        placeholder="Enter your phone number"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={closeEditModal}
                  >
                    <Ionicons name="close-outline" size={20} color="#DC2626" />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveProfile}
                  >
                    <Ionicons name="checkmark-outline" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity onPress={() => router.push("/home")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="home-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/appointment/appointmentSelection")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="cut-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/faq")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <View style={styles.navItemWrapActive}>
          <Ionicons name="person" size={20} color="#7A5A00" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F7F8" },
  container: { flex: 1 },
  header: {
    marginTop: height * 0.02,
    paddingHorizontal: width * 0.04,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
    textAlign: "center",
  },
  notificationBtn: {
    position: "relative",
    padding: 4,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  profileCard: {
    backgroundColor: "#fff",
    marginHorizontal: width * 0.04,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginBottom: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F5ECE3",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#94665B",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#F5ECE3",
    borderRadius: 20,
  },
  editProfileText: {
    color: "#94665B",
    fontWeight: "600",
    fontSize: 14,
  },

  section: {
    marginHorizontal: width * 0.04,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: "#94665B",
    fontWeight: "600",
  },

  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 8,
  },

  emptyOrders: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyOrdersText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptyOrdersSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },

  loadingContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  errorContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 12,
  },

  orderCards: {

  },
  serviceType: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  serviceName: {
    fontSize: 12,
    color: "#94665B",
    fontWeight: "600",
  },
  orderStatus: {
    marginBottom: 12,
  },
  priceComparison: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  priceValueEstimated: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  priceValueFinal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  priceChanged: {
    color: "#EF4444",
  },
  priceSame: {
    color: "#10B981",
  },
  priceChangeIndicator: {
    fontSize: 10,
    color: "#F59E0B",
  },
  adminNotes: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  notesText: {
    fontSize: 12,
    color: "#92400E",
    marginTop: 2,
  },
  orderTimeline: {
    marginBottom: 16,
  },
  timelineContainer: {
    flexDirection: "column",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  timelineItemCompleted: {

  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  timelineDotPending: {
    backgroundColor: "#D1D5DB",
  },
  timelineDotCompleted: {
    backgroundColor: "#10B981",
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  priceConfirmationActions: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  confirmationMessage: {
    marginBottom: 12,
  },
  confirmationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 4,
  },
  confirmationText: {
    fontSize: 14,
    color: "#92400E",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  btnAcceptPrice: {
    flex: 1,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  btnAcceptPriceText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },
  btnDeclinePrice: {
    flex: 1,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  btnDeclinePriceText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },

  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNo: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  orderPriceContainer: {
    justifyContent: "center",
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#94665B",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderDates: {
    flex: 1,
  },
  dateInfo: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },

  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  orderService: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  orderItem: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: height * 0.9,
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },

  modalAvatarSection: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F5ECE3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  changePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F5ECE3",
    borderRadius: 16,
  },
  changePhotoText: {
    color: "#94665B",
    fontWeight: "600",
    fontSize: 14,
  },

  formSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
  },

  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
  },
  textAreaContainer: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  textAreaIcon: {
    marginTop: 4,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 4,
  },

  modalButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FEE2E2",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  cancelButtonText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#94665B",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#94665B",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  viewDetailsText: {
    fontSize: 14,
    color: "#94665B",
    fontWeight: "600",
  },

  serviceDetails: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  serviceDetailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
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

  profileButtonsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  measurementsDropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  measurementsDropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  measurementsDropdownTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  measurementsDropdownContent: {
    backgroundColor: "#fff",
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  measurementsModalContainer: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: "auto",
  },
  measurementsModalContent: {
    padding: 20,
    flex: 1,
  },
  measurementsLoadingContainer: {
    padding: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  measurementsLoadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  measurementsContent: {
    paddingHorizontal: 0,
  },
  measurementSection: {
    marginBottom: 20,
  },
  measurementSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#8B4513",
  },
  measurementTable: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    overflow: "hidden",
  },
  measurementTableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderBottomWidth: 2,
    borderBottomColor: "#E0E0E0",
    padding: 12,
  },
  measurementHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  measurementRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  measurementRowEven: {
    backgroundColor: "#fff",
  },
  measurementRowOdd: {
    backgroundColor: "#FAFAFA",
  },
  measurementLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  measurementValue: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    textAlign: "right",
  },
  measurementNotesContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  measurementNotesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  measurementNotesText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  noMeasurementsContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  noMeasurementsText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  noMeasurementsSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  measurementsCloseButton: {
    backgroundColor: "#94665B",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  measurementsCloseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
