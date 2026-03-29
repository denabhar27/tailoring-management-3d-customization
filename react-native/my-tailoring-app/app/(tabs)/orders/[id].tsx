
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { orderTrackingService, API_BASE_URL } from "../../../utils/apiService";
import RentalImageCarousel from "../../../components/RentalImageCarousel";

const { width } = Dimensions.get("window");

const formatSize = (size: any): { label: string; value: string }[] | null => {
  if (!size) return null;

  if (typeof size === 'string' && !size.trim().startsWith('{')) {
    return [{ label: 'Size', value: size }];
  }

  try {

    let measurements = typeof size === 'string' ? JSON.parse(size) : size;

    if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
      return [{ label: 'Size', value: typeof size === 'string' ? size : JSON.stringify(size) }];
    }

    const labelMap: { [key: string]: string } = {
      'chest': 'Chest',
      'shoulders': 'Shoulders',
      'sleeveLength': 'Sleeve',
      'neck': 'Neck',
      'waist': 'Waist',
      'length': 'Length'
    };

    const parts = Object.entries(measurements)
      .filter(([key, value]) => value !== null && value !== undefined && value !== '' && value !== '0')
      .map(([key, value]) => {
        const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();

        let displayValue: string;
        if (typeof value === 'object' && value !== null) {
          const val = value as { inch?: string; cm?: string; value?: string };

          if (val.inch !== undefined && val.cm !== undefined) {
            displayValue = `${val.inch} in / ${val.cm} cm`;
          } else if (val.inch !== undefined) {
            displayValue = `${val.inch} in`;
          } else if (val.cm !== undefined) {
            displayValue = `${val.cm} cm`;
          } else if (val.value !== undefined) {
            displayValue = `${val.value} in`;
          } else {
            displayValue = JSON.stringify(value);
          }
        } else {
          displayValue = `${value} in`;
        }
        return { label, value: displayValue };
      });

    return parts.length > 0 ? parts : null;
  } catch (e) {

    return [{ label: 'Size', value: typeof size === 'string' ? size : 'N/A' }];
  }
};

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const result = await orderTrackingService.getUserOrderTracking();
      if (result.success) {

        let foundItem = null;
        for (const order of result.data) {
          const item = order.items.find((i: any) => i.order_item_id === parseInt(id));
          if (item) {
            foundItem = { ...item, order_date: order.order_date };
            break;
          }
        }
        setOrder(foundItem);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation');
      return;
    }

    setCancelling(true);
    try {
      const result = await orderTrackingService.cancelOrderItem(
        order.order_item_id.toString(),
        cancelReason.trim()
      );

      if (result.success) {
        Alert.alert('Success', 'Order cancelled successfully', [
          {
            text: 'OK',
            onPress: () => {
              setCancelModalVisible(false);
              setCancelReason('');
              router.push('/(tabs)/UserProfile/profile');
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to cancel order');
      }
    } catch (error: any) {
      console.error('Cancel order error:', error);
      Alert.alert('Error', error.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const canCancelOrder = () => {
    const status = order?.status?.toLowerCase();
    return status === 'pending';
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "#8B5CF6";
      case "in_progress":
      case "processing":
        return "#3B82F6";
      case "ready_to_pickup":
      case "to pick up":
        return "#F59E0B";
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      case "price_confirmation":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending": return "Pending";
      case "in_progress": return "In Progress";
      case "processing": return "Processing";
      case "ready_to_pickup": return "Ready to Pick Up";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      case "price_confirmation": return "Price Confirmation";
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#94665B" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/UserProfile/profile")}
          >
            <Ionicons name="arrow-back" size={26} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={styles.notFound}>Order not found</Text>
      </SafeAreaView>
    );
  }

  const statusColor = getStatusColor(order.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/UserProfile/profile")}
        >
          <Ionicons name="arrow-back" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.orderHeader}>
            <Text style={styles.serviceType}>
              {order.service_type === 'dry_cleaning' ? 'Dry Cleaning' : order.service_type.charAt(0).toUpperCase() + order.service_type.slice(1)} Service
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor + "20" },
              ]}
            >
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(order.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.date}>Placed on {formatDate(order.order_date)}</Text>

          <View style={styles.divider} />

          {/* For rental items, show 4-image carousel (front, back, side, main) */}
          {/* For bundle, show all images from all bundle items */}
          {order.service_type === 'rental' && (() => {
            const API_BASE = API_BASE_URL.replace('/api', '');
            const buildUrl = (url: string | null | undefined) => {
              if (!url || url === 'no-image' || url.trim() === '') return null;
              return url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
            };

            // Check if it's a bundle with multiple items
            const bundleItems = order.specific_data?.bundle_items || [];
            const isBundle = bundleItems.length > 0;

            if (isBundle) {
              // For bundles, collect all images from all bundle items
              const allBundleImages: { url: string; label: string }[] = [];
              bundleItems.forEach((item: any, idx: number) => {
                const itemName = item.item_name || `Item ${idx + 1}`;
                const itemImages = [
                  { url: buildUrl(item.front_image), label: `${itemName} - Front` },
                  { url: buildUrl(item.back_image), label: `${itemName} - Back` },
                  { url: buildUrl(item.side_image), label: `${itemName} - Side` },
                  { url: buildUrl(item.image_url), label: `${itemName} - Main` },
                ].filter(img => img.url) as { url: string; label: string }[];
                allBundleImages.push(...itemImages);
              });

              if (allBundleImages.length > 0) {
                return (
                  <RentalImageCarousel
                    images={allBundleImages}
                    itemName={`Rental Bundle (${bundleItems.length} items)`}
                    imageHeight={280}
                    showFullscreen={true}
                  />
                );
              }
              return null;
            }

            // For single rental item
            const rentalImages = [
              { url: buildUrl(order.specific_data?.front_image), label: 'Front' },
              { url: buildUrl(order.specific_data?.back_image), label: 'Back' },
              { url: buildUrl(order.specific_data?.side_image), label: 'Side' },
              { url: buildUrl(order.specific_data?.image_url || order.specific_data?.imageUrl || order.image_url), label: 'Main' },
            ].filter(img => img.url);

            if (rentalImages.length > 0) {
              return (
                <RentalImageCarousel
                  images={rentalImages}
                  itemName={order.specific_data?.item_name || 'Rental Item'}
                  imageHeight={280}
                  showFullscreen={true}
                />
              );
            }
            return null;
          })()}

          {/* For customization, show 4 angle images at the top instead of single image */}
          {(order.service_type === 'customization' || order.service_type === 'customize') &&
           order.specific_data?.designData?.angleImages && (
            <View style={styles.topAngleImagesContainer}>
              <View style={styles.angleImagesGrid}>
                {['front', 'back', 'right', 'left'].map((angle) => (
                  order.specific_data.designData.angleImages[angle] && (
                    <View key={angle} style={styles.angleImageContainer}>
                      <Image
                        source={{ uri: order.specific_data.designData.angleImages[angle] }}
                        style={styles.angleImage}
                        resizeMode="cover"
                      />
                      <View style={styles.angleLabel}>
                        <Text style={styles.angleLabelText}>
                          {angle.charAt(0).toUpperCase() + angle.slice(1)}
                        </Text>
                      </View>
                    </View>
                  )
                ))}
              </View>
            </View>
          )}

          {/* For dry_cleaning and repair, show images with carousel support */}
          {(order.service_type === 'dry_cleaning' || order.service_type === 'repair') && (() => {
            const API_BASE = API_BASE_URL.replace('/api', '');
            const buildUrl = (url: string | null | undefined) => {
              if (!url || url === 'no-image' || url.trim() === '') return null;
              return url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
            };

            // Check for imageUrls array first (multiple images)
            const imageUrls: string[] = order.specific_data?.imageUrls || [];
            const validImageUrls = imageUrls
              .map((url: string) => buildUrl(url))
              .filter((url: string | null): url is string => url !== null);

            // Fallback to single imageUrl
            if (validImageUrls.length === 0) {
              let singleUrl = order.specific_data?.imageUrl ||
                             order.specific_data?.image_url ||
                             order.specific_data?.designImage ||
                             order.specific_data?.item_image ||
                             order.specific_data?.completed_item_image ||
                             order.image_url;
              
              if (order.service_type === 'dry_cleaning' && !singleUrl) {
                singleUrl = order.specific_data?.completed_item_image || order.specific_data?.item_image;
              }
              if (order.service_type === 'repair' && !singleUrl) {
                singleUrl = order.specific_data?.damageImage ||
                           order.specific_data?.repairImage ||
                           order.specific_data?.item_image;
              }
              
              const builtUrl = buildUrl(singleUrl);
              if (builtUrl) validImageUrls.push(builtUrl);
            }

            if (validImageUrls.length === 0) return null;

            return (
              <View style={styles.imageCarouselContainer}>
                <Image
                  source={{ uri: validImageUrls[currentImageIndex] }}
                  style={styles.image}
                  resizeMode="cover"
                />
                {validImageUrls.length > 1 && (
                  <>
                    <TouchableOpacity
                      style={[styles.carouselArrow, styles.carouselArrowLeft]}
                      onPress={() => setCurrentImageIndex(prev => 
                        prev === 0 ? validImageUrls.length - 1 : prev - 1
                      )}
                    >
                      <Ionicons name="chevron-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.carouselArrow, styles.carouselArrowRight]}
                      onPress={() => setCurrentImageIndex(prev => 
                        prev === validImageUrls.length - 1 ? 0 : prev + 1
                      )}
                    >
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.carouselIndicator}>
                      <Text style={styles.carouselIndicatorText}>
                        {currentImageIndex + 1} / {validImageUrls.length}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            );
          })()}

          {/* For non-customization, non-rental, non-dry_cleaning, non-repair services, show single image */}
          {order.service_type !== 'customization' && order.service_type !== 'customize' && 
           order.service_type !== 'rental' && order.service_type !== 'dry_cleaning' && 
           order.service_type !== 'repair' && (() => {

            let imageUrl = order.specific_data?.imageUrl ||
                          order.specific_data?.image_url ||
                          order.specific_data?.designImage ||
                          order.specific_data?.item_image ||
                          order.specific_data?.completed_item_image ||
                          order.image_url;

            const hasValidImage = imageUrl && imageUrl !== 'no-image' && imageUrl.trim() !== '';

            if (hasValidImage) {
              const API_BASE = API_BASE_URL.replace('/api', '');
              const fullImageUrl = imageUrl.startsWith('http')
                ? imageUrl
                : `${API_BASE}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

              return (
                <View>
                  <Image
                    source={{ uri: fullImageUrl }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                </View>
              );
            }
            return null;
          })()}
          {order.specific_data && (
            <View style={styles.serviceDetailsSection}>
              <Text style={styles.sectionTitle}>Service Details</Text>
              {order.service_type === 'dry_cleaning' && (
                <>
                  {order.specific_data.serviceName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Service</Text>
                      <Text style={styles.value}>{order.specific_data.serviceName}</Text>
                    </View>
                  )}
                  {/* Multiple garments support */}
                  {order.specific_data.garments && order.specific_data.garments.length > 0 ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Garments ({order.specific_data.garments.length})</Text>
                      </View>
                      {order.specific_data.garments.map((garment: any, idx: number) => {
                        const pricePerItem = garment.isEstimated ? 350 : (garment.pricePerItem || 0);
                        const totalPrice = pricePerItem * (garment.quantity || 1);
                        return (
                          <View key={idx} style={styles.garmentCard}>
                            <Text style={styles.garmentTitle}>Garment {idx + 1}</Text>
                            <Text style={styles.garmentDetail}>Type: {garment.garmentType} {garment.brand ? `(${garment.brand})` : ''}</Text>
                            {garment.brand && <Text style={styles.garmentDetail}>Brand: {garment.brand}</Text>}
                            <Text style={styles.garmentDetail}>Quantity: {garment.quantity}</Text>
                            <Text style={styles.garmentDetail}>Price: ₱{totalPrice}</Text>
                          </View>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      {order.specific_data.garmentType && (
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>Garment Type</Text>
                          <Text style={styles.value}>{order.specific_data.garmentType}</Text>
                        </View>
                      )}
                      {order.specific_data.clothingBrand && (
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>Brand</Text>
                          <Text style={styles.value}>{order.specific_data.clothingBrand}</Text>
                        </View>
                      )}
                      {order.specific_data.quantity && (
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>Quantity</Text>
                          <Text style={styles.value}>{order.specific_data.quantity} items</Text>
                        </View>
                      )}
                    </>
                  )}
                  {order.specific_data.specialInstructions && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Special Instructions</Text>
                      <Text style={[styles.value, styles.multiline]}>
                        {order.specific_data.specialInstructions}
                      </Text>
                    </View>
                  )}
                  {order.specific_data.pickupDate && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Pickup Date</Text>
                      <Text style={styles.value}>
                        {formatDate(order.specific_data.pickupDate)}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {order.service_type === 'repair' && (
                <>
                  {/* Multiple garments support */}
                  {order.specific_data.garments && order.specific_data.garments.length > 0 ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.label}>Garments ({order.specific_data.garments.length})</Text>
                      </View>
                      {order.specific_data.garments.map((garment: any, idx: number) => (
                        <View key={idx} style={styles.garmentCard}>
                          <Text style={styles.garmentTitle}>Garment {idx + 1}</Text>
                          <Text style={styles.garmentDetail}>Type: {garment.garmentType}</Text>
                          <Text style={styles.garmentDetail}>Damage Level: {garment.damageLevel}</Text>
                          {garment.notes && <Text style={styles.garmentDetail}>Description: {garment.notes}</Text>}
                          <Text style={styles.garmentDetail}>Price: ₱{garment.basePrice || 0}</Text>
                        </View>
                      ))}
                    </>
                  ) : (
                    <>
                      {order.specific_data.garmentType && (
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>Garment Type</Text>
                          <Text style={styles.value}>{order.specific_data.garmentType}</Text>
                        </View>
                      )}
                      {order.specific_data.damageLevel && (
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>Damage Level</Text>
                          <Text style={styles.value}>{order.specific_data.damageLevel}</Text>
                        </View>
                      )}
                      {order.specific_data.damageDescription && (
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>Damage Description</Text>
                          <Text style={[styles.value, styles.multiline]}>
                            {order.specific_data.damageDescription}
                          </Text>
                        </View>
                      )}
                      {order.specific_data.damageLocation && (
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>Damage Location</Text>
                          <Text style={styles.value}>{order.specific_data.damageLocation}</Text>
                        </View>
                      )}
                    </>
                  )}
                  {order.specific_data.pickupDate && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Expected Pickup Date</Text>
                      <Text style={styles.value}>
                        {formatDate(order.specific_data.pickupDate)}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {order.service_type === 'rental' && (
                <>
                  {order.specific_data.item_name && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Item Name</Text>
                      <Text style={styles.value}>{order.specific_data.item_name}</Text>
                    </View>
                  )}
                  {/* Only show brand if not a bundle (Multiple) */}
                  {order.specific_data.brand && order.specific_data.brand !== 'Multiple' && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Brand</Text>
                      <Text style={styles.value}>{order.specific_data.brand}</Text>
                    </View>
                  )}
                  {/* Display selected sizes with measurements */}
                  {(() => {
                    const selectedSizes = order.specific_data.selected_sizes || order.specific_data.selectedSizes || [];
                    const sizeOptions = order.specific_data.size_options || {};
                    const bundleItems = order.specific_data.bundle_items || [];
                    const isBundle = bundleItems.length > 0;

                    if (isBundle) {
                      return (
                        <View style={styles.sizeSection}>
                          <Text style={styles.sizeSectionTitle}>Customer Selected Sizes</Text>
                          {bundleItems.map((item: any, itemIdx: number) => {
                            const itemSelectedSizes = item.selected_sizes || item.selectedSizes || [];
                            const itemSizeOptions = item.size_options || {};
                            return (
                              <View key={itemIdx} style={styles.bundleItemContainer}>
                                <Text style={styles.bundleItemName}>
                                  {item.item_name || `Item ${itemIdx + 1}`}
                                </Text>
                                {itemSelectedSizes.map((sizeEntry: any, sizeIdx: number) => {
                                  const sizeKey = sizeEntry.sizeKey || sizeEntry.size_key || sizeEntry.label?.toLowerCase();
                                  const measurements = sizeEntry.measurements || sizeEntry.measurement_profile || sizeEntry.measurementProfile || (itemSizeOptions[sizeKey]?.measurements);
                                  const hasMeasurements = measurements && typeof measurements === 'object' && Object.keys(measurements).length > 0;
                                  
                                  return (
                                    <View key={sizeIdx} style={styles.sizeEntryContainer}>
                                      <View style={styles.sizeHeaderRow}>
                                        <Text style={styles.sizeEntryLabel}>{sizeEntry.label || sizeEntry.sizeKey}</Text>
                                        <Text style={styles.sizeEntryQuantity}>x{sizeEntry.quantity}</Text>
                                      </View>
                                      {hasMeasurements && (
                                        <View style={styles.measurementTable}>
                                          <View style={styles.measurementHeaderRow}>
                                            <Text style={[styles.measurementHeaderCell, { flex: 2 }]}>Measurement</Text>
                                            <Text style={[styles.measurementHeaderCell, { flex: 1 }]}>Inches</Text>
                                            <Text style={[styles.measurementHeaderCell, { flex: 1 }]}>CM</Text>
                                          </View>
                                          {Object.entries(measurements).map(([key, value]: [string, any]) => {
                                            if (!value) return null;
                                            const isObject = typeof value === 'object' && value !== null;
                                            if (isObject && !value.inch && !value.cm) return null;
                                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                                            const inchValue = isObject ? (value.inch || '-') : (value || '-');
                                            const cmValue = isObject ? (value.cm || '-') : '-';
                                            return (
                                              <View key={key} style={styles.measurementRow}>
                                                <Text style={[styles.measurementCell, { flex: 2 }]}>{label}</Text>
                                                <Text style={[styles.measurementCell, { flex: 1 }]}>{inchValue}</Text>
                                                <Text style={[styles.measurementCell, { flex: 1 }]}>{cmValue}</Text>
                                              </View>
                                            );
                                          })}
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            );
                          })}
                        </View>
                      );
                    } else if (selectedSizes.length > 0) {
                      return (
                        <View style={styles.sizeSection}>
                          <Text style={styles.sizeSectionTitle}>Customer Selected Sizes</Text>
                          <View style={styles.sizeContainer}>
                            {selectedSizes.map((sizeEntry: any, sizeIdx: number) => {
                              const sizeKey = sizeEntry.sizeKey || sizeEntry.size_key || sizeEntry.label?.toLowerCase();
                              const measurements = sizeEntry.measurements || sizeEntry.measurement_profile || sizeEntry.measurementProfile || (sizeOptions[sizeKey]?.measurements);
                              const hasMeasurements = measurements && typeof measurements === 'object' && Object.keys(measurements).length > 0;
                              
                              return (
                                <View key={sizeIdx} style={styles.sizeEntryContainer}>
                                  <View style={styles.sizeHeaderRow}>
                                    <Text style={styles.sizeEntryLabel}>{sizeEntry.label || sizeEntry.sizeKey}</Text>
                                    <Text style={styles.sizeEntryQuantity}>x{sizeEntry.quantity}</Text>
                                  </View>
                                  {hasMeasurements && (
                                    <View style={styles.measurementTable}>
                                      <View style={styles.measurementHeaderRow}>
                                        <Text style={[styles.measurementHeaderCell, { flex: 2 }]}>Measurement</Text>
                                        <Text style={[styles.measurementHeaderCell, { flex: 1 }]}>Inches</Text>
                                        <Text style={[styles.measurementHeaderCell, { flex: 1 }]}>CM</Text>
                                      </View>
                                      {Object.entries(measurements).map(([key, value]: [string, any]) => {
                                        if (!value || (typeof value === 'object' && !value.inch && !value.cm)) return null;
                                        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                                        const inchValue = typeof value === 'object' ? (value.inch || '-') : value;
                                        const cmValue = typeof value === 'object' ? (value.cm || '-') : '-';
                                        return (
                                          <View key={key} style={styles.measurementRow}>
                                            <Text style={[styles.measurementCell, { flex: 2 }]}>{label}</Text>
                                            <Text style={[styles.measurementCell, { flex: 1 }]}>{inchValue}</Text>
                                            <Text style={[styles.measurementCell, { flex: 1 }]}>{cmValue}</Text>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    }
                    return null;
                  })()}
                  {/* Only show size details if not a bundle (Various) */}
                  {order.specific_data.size && order.specific_data.size !== 'Various' && (
                    <View style={styles.sizeSection}>
                      <Text style={styles.sizeSectionTitle}>Size Details</Text>
                      <View style={styles.sizeContainer}>
                        {(() => {
                          const sizeData = formatSize(order.specific_data.size);
                          if (sizeData && Array.isArray(sizeData)) {
                            return sizeData.map((measurement, idx) => (
                              <View key={idx} style={styles.sizeRow}>
                                <Text style={styles.sizeLabel}>{measurement.label}:</Text>
                                <Text style={styles.sizeValue}>{measurement.value}</Text>
                              </View>
                            ));
                          }
                          return <Text style={styles.sizeValueSimple}>N/A</Text>;
                        })()}
                      </View>
                    </View>
                  )}
                  {order.specific_data.bundle_items && order.specific_data.bundle_items.length > 0 && (
                    <View style={styles.sizeSection}>
                      <Text style={styles.sizeSectionTitle}>Bundle Items ({order.specific_data.bundle_items.length})</Text>
                      {order.specific_data.bundle_items.map((item: any, itemIdx: number) => (
                        <View key={itemIdx} style={styles.bundleItemContainer}>
                          <Text style={styles.bundleItemName}>
                            {item.item_name || `Item ${itemIdx + 1}`}
                          </Text>
                          {item.brand && (
                            <Text style={styles.bundleItemDetail}>Brand: {item.brand}</Text>
                          )}
                          {item.category && item.category !== 'rental' && item.category !== 'rental_bundle' && (
                            <Text style={styles.bundleItemDetail}>
                              Category: {item.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Text>
                          )}
                          <View style={styles.sizeContainer}>
                            {(() => {
                              const sizeData = formatSize(item.size);
                              if (sizeData && Array.isArray(sizeData)) {
                                return sizeData.map((measurement, idx) => (
                                  <View key={idx} style={styles.sizeRow}>
                                    <Text style={styles.sizeLabel}>{measurement.label}:</Text>
                                    <Text style={styles.sizeValue}>{measurement.value}</Text>
                                  </View>
                                ));
                              }
                              return <Text style={styles.sizeValueSimple}>N/A</Text>;
                            })()}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {order.specific_data.category && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Category</Text>
                      <Text style={styles.value}>
                        {order.specific_data.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Text>
                    </View>
                  )}
                  {order.specific_data.color && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Color</Text>
                      <Text style={styles.value}>{order.specific_data.color}</Text>
                    </View>
                  )}
                  {order.specific_data.material && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Fabric/Material</Text>
                      <Text style={styles.value}>{order.specific_data.material}</Text>
                    </View>
                  )}
                  {order.specific_data.description && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Description</Text>
                      <Text style={[styles.value, styles.multiline]}>{order.specific_data.description}</Text>
                    </View>
                  )}
                  {order.rental_period && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Rental Period</Text>
                      <Text style={styles.value}>{order.rental_period} days</Text>
                    </View>
                  )}
                  {order.rental_start_date && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Start Date</Text>
                      <Text style={styles.value}>{formatDate(order.rental_start_date)}</Text>
                    </View>
                  )}
                  {order.rental_end_date && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>End Date</Text>
                      <Text style={styles.value}>{formatDate(order.rental_end_date)}</Text>
                    </View>
                  )}
                </>
              )}
              {(order.service_type === 'customization' || order.service_type === 'customize') && (
                <>
                  {order.specific_data?.garmentType && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Garment Type</Text>
                      <Text style={styles.value}>{order.specific_data.garmentType}</Text>
                    </View>
                  )}
                  {order.specific_data?.fabricType && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Fabric Type</Text>
                      <Text style={styles.value}>{order.specific_data.fabricType}</Text>
                    </View>
                  )}
                  {order.specific_data?.preferredDate && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Preferred Date</Text>
                      <Text style={styles.value}>{formatDate(order.specific_data.preferredDate)}</Text>
                    </View>
                  )}
                  {order.specific_data?.preferredTime && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Preferred Time</Text>
                      <Text style={styles.value}>{order.specific_data.preferredTime}</Text>
                    </View>
                  )}
                  {order.specific_data?.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>Notes</Text>
                      <Text style={[styles.value, styles.multiline]}>{order.specific_data.notes}</Text>
                    </View>
                  )}
                  {order.specific_data?.designData && (
                    <View style={styles.detailRow}>
                      <Text style={styles.label}>3D Customization Details</Text>
                      <Text style={[styles.value, styles.multiline]}>
                        {order.specific_data.designData.size && `Size: ${order.specific_data.designData.size.charAt(0).toUpperCase() + order.specific_data.designData.size.slice(1)}\n`}
                        {order.specific_data.designData.fit && `Fit: ${order.specific_data.designData.fit.charAt(0).toUpperCase() + order.specific_data.designData.fit.slice(1)}\n`}
                        {order.specific_data.designData.colors?.fabric && `Color: ${order.specific_data.designData.colors.fabric}\n`}
                        {order.specific_data.designData.pattern && order.specific_data.designData.pattern !== 'none' && `Pattern: ${order.specific_data.designData.pattern.charAt(0).toUpperCase() + order.specific_data.designData.pattern.slice(1)}\n`}
                        {order.specific_data.designData.personalization?.initials && `Personalization: ${order.specific_data.designData.personalization.initials}`}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
          <View style={styles.priceSection}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            {(() => {

              if (order.service_type === 'rental') {
                const price = parseFloat(order.final_price || order.base_price || '0');
                if (price > 0) {
                  return (
                    <Text style={styles.totalPrice}>
                      ₱{price.toLocaleString()}
                    </Text>
                  );
                }
              }

              if (order.price_confirmed || order.final_price) {
                const price = parseFloat(order.final_price || order.base_price || '0');
                if (price > 0) {
                  return (
                    <Text style={styles.totalPrice}>
                      ₱{price.toLocaleString()}
                    </Text>
                  );
                }
              }

              return (
                <Text style={styles.pricePending}>
                  To be confirmed by admin
                </Text>
              );
            })()}
          </View>
          <TouchableOpacity
            style={styles.transactionLogButton}
            onPress={() => {
              if (order.order_item_id) {
                router.push({
                  pathname: "/(tabs)/orders/TransactionLog",
                  params: { orderItemId: order.order_item_id.toString() },
                });
              } else {
                Alert.alert("Error", "Order item ID not found");
              }
            }}
          >
            <Ionicons name="receipt-outline" size={20} color="#fff" />
            <Text style={styles.transactionLogButtonText}>View Transaction Log</Text>
          </TouchableOpacity>

          {/* Cancel Order Button - only show for pending or price_confirmation status */}
          {canCancelOrder() && (
            <TouchableOpacity
              style={styles.cancelOrderButton}
              onPress={() => setCancelModalVisible(true)}
            >
              <Ionicons name="close-circle-outline" size={20} color="#fff" />
              <Text style={styles.cancelOrderButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Cancel Order Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModal}>
            <View style={styles.cancelModalHeader}>
              <Text style={styles.cancelModalTitle}>Cancel Order</Text>
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setCancelReason('');
                }}
                style={styles.cancelModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.cancelModalSubtitle}>
              Please provide a reason for cancelling this order:
            </Text>

            <TextInput
              style={styles.cancelReasonInput}
              placeholder="Enter reason for cancellation..."
              placeholderTextColor="#9CA3AF"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.cancelModalButtons}>
              <TouchableOpacity
                style={styles.cancelModalCancelButton}
                onPress={() => {
                  setCancelModalVisible(false);
                  setCancelReason('');
                }}
              >
                <Text style={styles.cancelModalCancelButtonText}>Go Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cancelModalConfirmButton,
                  (!cancelReason.trim() || cancelling) && styles.cancelModalConfirmButtonDisabled
                ]}
                onPress={handleCancelOrder}
                disabled={!cancelReason.trim() || cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.cancelModalConfirmButtonText}>Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 20 : 10,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1F2937" },
  scrollContent: { padding: 20, paddingBottom: 140 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderNo: { fontSize: 19, fontWeight: "700", color: "#1F2937" },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  statusText: { fontSize: 14, fontWeight: "600" },
  date: { fontSize: 14, color: "#6B7280", marginBottom: 4 },
  serviceType: {
    fontSize: 19,
    color: "#1F2937",
    fontWeight: "700",
  },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20 },
  image: {
    width: "100%",
    height: 280,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: "#F9FAFB",
  },
  serviceDetailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
  },
  detailRow: { marginBottom: 18 },
  label: { fontSize: 14, color: "#6B7280", marginBottom: 6 },
  value: { fontSize: 17, color: "#1F2937", fontWeight: "500", lineHeight: 24 },
  multiline: { lineHeight: 26 },
  priceSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: "#F3F4F6",
    alignItems: "flex-end",
  },
  totalLabel: { fontSize: 18, color: "#6B7280", marginBottom: 6 },
  totalPrice: { fontSize: 32, fontWeight: "800", color: "#94665B" },
  pricePending: { fontSize: 18, fontWeight: "600", color: "#F59E0B", fontStyle: "italic" },
  transactionLogButton: {
    marginTop: 20,
    backgroundColor: "#8B4513",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  transactionLogButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelOrderButton: {
    marginTop: 12,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  cancelOrderButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  cancelModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  cancelModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  cancelModalCloseButton: {
    padding: 4,
  },
  cancelModalSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 16,
  },
  cancelReasonInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1F2937",
    minHeight: 100,
    backgroundColor: "#F9FAFB",
  },
  cancelModalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelModalCancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  cancelModalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  cancelModalConfirmButtonDisabled: {
    backgroundColor: "#FCA5A5",
  },
  cancelModalConfirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  notFound: {
    flex: 1,
    textAlign: "center",
    marginTop: 100,
    fontSize: 18,
    color: "#6B7280",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
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

  sizeSection: {
    marginVertical: 16,
  },
  sizeSectionTitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  sizeContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sizeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
    flex: 1,
  },
  sizeValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    textAlign: "right",
  },
  sizeValueSimple: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },

  bundleItemContainer: {
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  bundleItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#DDD",
    textAlign: "center",
  },
  bundleItemDetail: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
    textAlign: "center",
  },

  garmentCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  garmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4037',
    marginBottom: 6,
  },
  garmentDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },

  angleImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  angleImageContainer: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    marginBottom: 8,
  },
  angleImage: {
    width: '100%',
    height: '100%',
  },
  angleLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  angleLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  topAngleImagesContainer: {
    marginBottom: 16,
  },
  imageCarouselContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  carouselArrowLeft: {
    left: 10,
  },
  carouselArrowRight: {
    right: 10,
  },
  carouselIndicator: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  carouselIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  sizeEntryContainer: {
    marginBottom: 12,
  },
  sizeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sizeEntryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  sizeEntryQuantity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  measurementTable: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  measurementHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  measurementHeaderCell: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'left',
  },
  measurementRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FAFAFA',
  },
  measurementCell: {
    fontSize: 13,
    color: '#555',
    textAlign: 'left',
  },
});
