
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Platform,
  Dimensions,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CartItem } from "../../../utils/cartStore";
import { orderStore } from "../../../utils/orderStore";
import { cartService, API_BASE_URL } from "../../../utils/apiService";
import RentalImageCarousel from "../../../components/RentalImageCarousel";

const { width, height } = Dimensions.get("window");

const formatServiceType = (serviceType: string): string => {
  switch (serviceType?.toLowerCase()) {
    case 'dry_cleaning':
      return 'Dry Cleaning';
    case 'customize':
    case 'customization':
      return 'Customization';
    case 'repair':
      return 'Repair';
    case 'rental':
      return 'Rental';
    default:
      return serviceType || 'Service';
  }
};

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
    return [{ label: 'Size', value: typeof size === 'string' ? size : JSON.stringify(size) }];
  }
};

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] =
    useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderNotes, setOrderNotes] = useState('');
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleItems, setBundleItems] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchCartItems();
  }, []);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const response = await cartService.getCart();
      console.log('Raw cart response from backend:', response);
      if (response.success) {
        console.log('Cart items from backend:', response.items);

          const transformedItems = response.items.map((item: any) => {
          console.log('Processing cart item:', item);
          console.log('Specific data:', item.specific_data);
          console.log('Image URL from backend:', item.specific_data?.imageUrl);

          const API_BASE = API_BASE_URL.replace('/api', '');

          const isBundle = item.specific_data?.is_bundle || item.pricing_factors?.is_bundle;
          const bundleItems = item.specific_data?.bundle_items || [];

          let imageUrl = item.specific_data?.imageUrl ||
                        item.specific_data?.image_url ||
                        item.specific_data?.designImage;

          if (item.service_type === 'rental' && !imageUrl) {
            imageUrl = item.specific_data?.image_url || (bundleItems.length > 0 ? bundleItems[0]?.image_url : null);
          }

          let processedImage = '';
          if (imageUrl && imageUrl !== 'no-image' && imageUrl.trim() !== '') {
            processedImage = imageUrl.startsWith('http') ? imageUrl : `${API_BASE}${imageUrl}`;
            console.log('Processed image URL:', processedImage);
          }

          const rawDate = item.specific_data?.pickupDate || item.specific_data?.preferredDate || item.appointment_date;
          const appointmentTime = item.specific_data?.appointmentTime;
          let formattedDate = '';

          if (rawDate) {
            try {

              if (rawDate.includes('T') && rawDate.match(/\d{2}:\d{2}/)) {
                const date = new Date(rawDate);
                formattedDate = date.toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
              } else if (appointmentTime) {

                const dateOnly = new Date(rawDate);
                const timeParts = appointmentTime.split(':');
                if (timeParts.length >= 2) {
                  dateOnly.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0);
                  formattedDate = dateOnly.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                } else {

                  formattedDate = dateOnly.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                }
              } else {

                const date = new Date(rawDate);
                formattedDate = date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
              }
            } catch (e) {
              formattedDate = rawDate;
            }
          }

          return {
            id: item.cart_id,
            service: item.service_type,
            serviceId: item.service_id,
            item: item.specific_data?.serviceName || formatServiceType(item.service_type),
            description: item.specific_data?.damageDescription || item.specific_data?.specialInstructions || '',
            price: parseFloat(item.final_price) || 0,
            basePrice: parseFloat(item.base_price) || 0,
            icon: getServiceIcon(item.service_type),

            garments: item.specific_data?.garments || [],
            garmentType: item.specific_data?.garments?.[0]?.garmentType || item.specific_data?.garmentType || '',
            damageType: item.specific_data?.garments?.[0]?.damageLevel || item.specific_data?.damageLevel || item.specific_data?.damageType || '',
            damageDescription: item.specific_data?.garments?.[0]?.notes || item.specific_data?.damageDescription || '',
            specialInstructions: item.specific_data?.specialInstructions || '',
            image: processedImage,
            imageUrls: (() => {
              const urls = item.specific_data?.imageUrls;
              if (!urls || urls.length === 0) return [];
              return urls.map((url: string) => 
                url.startsWith('http') ? url : `${API_BASE}${url}`
              );
            })(),
            appointmentDate: formattedDate,

            clothingBrand: item.specific_data?.garments?.[0]?.brand || item.specific_data?.clothingBrand || item.specific_data?.brand || '',
            quantity: item.specific_data?.quantity || 1,
            fabricType: item.specific_data?.fabricType || '',
            style: item.specific_data?.style || '',
            buttonStyle: item.specific_data?.buttonStyle || '',
            sizeMeasurement: item.specific_data?.sizeMeasurement || '',

            downpayment: item.pricing_factors?.downpayment || item.specific_data?.downpayment || 0,
            rentalStartDate: item.rental_start_date || '',
            rentalEndDate: item.rental_end_date || '',

            pricePerItem: item.specific_data?.garments?.[0]?.pricePerItem || item.specific_data?.pricePerItem || '',
            isEstimatedPrice: item.specific_data?.isEstimatedPrice || false,

            preferredDate: item.specific_data?.preferredDate || '',
            preferredTime: item.specific_data?.preferredTime || '',
            notes: item.specific_data?.notes || '',
            designData: item.specific_data?.designData || null,

            isBundle: isBundle,
            bundleItems: bundleItems,

            frontImage: (() => {
              const img = item.specific_data?.front_image;
              if (!img || img === 'no-image' || img.trim() === '') return null;
              return img.startsWith('http') ? img : `${API_BASE}${img}`;
            })(),
            backImage: (() => {
              const img = item.specific_data?.back_image;
              if (!img || img === 'no-image' || img.trim() === '') return null;
              return img.startsWith('http') ? img : `${API_BASE}${img}`;
            })(),
            sideImage: (() => {
              const img = item.specific_data?.side_image;
              if (!img || img === 'no-image' || img.trim() === '') return null;
              return img.startsWith('http') ? img : `${API_BASE}${img}`;
            })(),

            rentalItemName: item.specific_data?.item_name || '',
            rentalBrand: item.specific_data?.brand || '',
            rentalSize: item.specific_data?.size || '',
            rentalColor: item.specific_data?.color || '',
            rentalMaterial: item.specific_data?.material || '',
            rentalCategory: item.specific_data?.category || '',
            rentalDescription: item.specific_data?.description || '',

            rawItem: item,
          };
        });
        console.log('Transformed cart items:', transformedItems);
        setCartItems(transformedItems);
      }
    } catch (error) {
      console.error("Error fetching cart items:", error);
      Alert.alert("Error", "Failed to load cart items");
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (serviceType: string): string => {
    switch (serviceType?.toLowerCase()) {
      case 'dry_cleaning':
        return 'water-outline';
      case 'customize':
      case 'customization':
        return 'color-palette-outline';
      case 'repair':
        return 'construct-outline';
      case 'rental':
        return 'shirt-outline';
      default:
        return 'shirt-outline';
    }
  };

  const getServiceTypeDisplay = (serviceType: string): string => {
    switch (serviceType?.toLowerCase()) {
      case 'dry_cleaning':
        return 'Dry Cleaning';
      case 'customize':
      case 'customization':
        return 'Customization';
      case 'repair':
        return 'Repair';
      case 'rental':
        return 'Rental';
      default:
        return serviceType || 'Service';
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllItems = () => {
    setSelectedItems(
      selectedItems.length === cartItems.length
        ? []
        : cartItems.map((item) => item.id)
    );
  };

  const getSelectedTotal = () => {
    return cartItems
      .filter((item) => selectedItems.includes(item.id))
      .reduce((sum, item) => sum + item.price, 0);
  };

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      alert("Please select at least one service");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmBooking = async () => {
    try {
      setLoading(true);

      const response = await cartService.submitCart(orderNotes, selectedItems);
      if (response.success) {

        const selectedCartItems = cartItems.filter((item) =>
          selectedItems.includes(item.id)
        );

        selectedCartItems.forEach((item) => {
          orderStore.addOrder({
            service: item.service,
            item: item.item,
            description: item.description,
            price: item.price,
            status: "Pending",
            estimatedCompletion: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            garmentType: item.garmentType,
            damageType: item.damageType,
            specialInstructions: item.specialInstructions,
            clothingBrand: item.clothingBrand,
            quantity: item.quantity,
            image: item.image,
            appointmentDate: item.appointmentDate || "Not specified",
          });
        });

        setCartItems(prev => prev.filter(item => !selectedItems.includes(item.id)));
        setSelectedItems([]);
        setOrderNotes('');
        setShowConfirmModal(false);

        await fetchCartItems();

        Alert.alert(
          "Success",
          "Order submitted successfully! Check your order history.",
          [
            {
              text: "OK",
              onPress: () => {

                setTimeout(() => {
                  try {
                    router.replace("/home");
                  } catch (navError) {
                    console.error("Navigation error:", navError);

                    try {
                      router.push("/home");
                    } catch (pushError) {
                      console.error("Push navigation also failed:", pushError);
                    }
                  }
                }, 100);
              }
            }
          ],
          { cancelable: false }
        );
      } else {
        Alert.alert("Error", response.message || "Failed to submit cart");
      }
    } catch (error) {
      console.error("Error submitting cart:", error);
      Alert.alert("Error", "Failed to submit cart");
    } finally {
      setLoading(false);
    }
  };

  const showItemDetails = (item: any) => {
    console.log('Showing item details:', item);
    console.log('Image URL:', item.image);
    setCurrentImageIndex(0);
    setSelectedItemDetails(item);
    setShowDetailsModal(true);
  };

  const handleRemoveItem = async (id: string) => {
    try {
      const response = await cartService.removeFromCart(id);
      if (response.success) {
        setCartItems((prev) => prev.filter((item) => item.id !== id));
        setSelectedItems((prev) => prev.filter((i) => i !== id));
        Alert.alert("Success", "Item removed from cart");
      } else {
        Alert.alert("Error", response.message || "Failed to remove item");
      }
    } catch (error) {
      console.error("Error removing item:", error);
      Alert.alert("Error", "Failed to remove item");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 180 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Cart</Text>
          <TouchableOpacity onPress={selectAllItems}>
            <Text style={styles.selectAllText}>
              {selectedItems.length === cartItems.length && cartItems.length > 0
                ? "Deselect"
                : "Select All"}
            </Text>
          </TouchableOpacity>
        </View>
        {cartItems.length === 0 ? (
          <View style={styles.emptyCart}>
            <Ionicons name="cart-outline" size={100} color="#D1D5DB" />
            <Text style={styles.emptyCartText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push("/home")}
            >
              <Text style={styles.shopButtonText}>Browse Services</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.cartList}>
              {cartItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.cartItem,
                    selectedItems.includes(item.id) && styles.cartItemSelected,
                  ]}
                  onPress={() => toggleItemSelection(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.checkboxContainer}>
                    <View
                      style={[
                        styles.checkbox,
                        selectedItems.includes(item.id) &&
                          styles.checkboxChecked,
                      ]}
                    >
                      {selectedItems.includes(item.id) && (
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      )}
                    </View>
                  </View>
                  {item.image && item.image !== 'no-image' && item.image.trim() !== '' ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.rentalImageThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={item.icon as any}
                        size={32}
                        color="#94665B"
                      />
                    </View>
                  )}
                  <View style={styles.itemDetails}>
                    {item.isBundle && (
                      <Text style={styles.bundleBadge}>
                        Bundle ({item.bundleItems?.length || 0} items) - Tap to view
                      </Text>
                    )}
                    <Text style={styles.itemName}>{item.item}</Text>
                    {item.service?.toLowerCase() === 'repair' && (
                      <>
                        {/* Multiple garments support */}
                        {item.garments && item.garments.length > 0 ? (
                          <>
                            <Text style={styles.itemDetailText}>
                              <Text style={{ fontWeight: 'bold' }}>{item.garments.length} Garment{item.garments.length > 1 ? 's' : ''}</Text>
                            </Text>
                            {item.garments.map((garment: any, idx: number) => (
                              <Text key={idx} style={styles.itemDetailText}>
                                • {garment.garmentType} ({garment.damageLevel}): ₱{garment.basePrice}
                              </Text>
                            ))}
                          </>
                        ) : (
                          <>
                            {item.damageType && (
                              <Text style={styles.itemDetailText}>Damage Level: {item.damageType}</Text>
                            )}
                            {item.garmentType && (
                              <Text style={styles.itemDetailText}>Garment: {item.garmentType}</Text>
                            )}
                            {item.damageDescription && (
                              <Text style={styles.itemDetailText} numberOfLines={2}>
                                Description: {item.damageDescription}
                              </Text>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {item.service?.toLowerCase() === 'dry_cleaning' && (
                      <>
                        {/* Multiple garments support */}
                        {item.garments && item.garments.length > 0 ? (
                          <>
                            <Text style={styles.itemDetailText}>
                              <Text style={{ fontWeight: 'bold' }}>{item.garments.length} Garment{item.garments.length > 1 ? 's' : ''}</Text>
                            </Text>
                            {item.garments.map((garment: any, idx: number) => (
                              <Text key={idx} style={styles.itemDetailText}>
                                • {garment.garmentType} ({garment.brand}) × {garment.quantity}: ₱{garment.pricePerItem * garment.quantity}
                              </Text>
                            ))}
                          </>
                        ) : (
                          <>
                            {item.garmentType && (
                              <Text style={styles.itemDetailText}>
                                Garment Type: {item.garmentType.charAt(0).toUpperCase() + item.garmentType.slice(1)}
                              </Text>
                            )}
                            {item.clothingBrand && (
                              <Text style={styles.itemDetailText}>Brand: {item.clothingBrand}</Text>
                            )}
                            {item.quantity > 0 && (
                              <Text style={styles.itemDetailText}>Quantity: {item.quantity} items</Text>
                            )}
                            {item.pricePerItem && (
                              <Text style={styles.itemDetailText}>
                                Price per item: ₱{parseFloat(item.pricePerItem).toFixed(2)}
                              </Text>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {item.service?.toLowerCase() === 'customization' && (
                      <>
                        {item.garmentType && (
                          <Text style={styles.itemDetailText}>Garment Type: {item.garmentType}</Text>
                        )}
                        {item.fabricType && (
                          <Text style={styles.itemDetailText}>Fabric Type: {item.fabricType}</Text>
                        )}
                        {item.preferredDate && (
                          <Text style={styles.itemDetailText}>Preferred Date: {item.preferredDate}</Text>
                        )}
                        {item.preferredTime && (
                          <Text style={styles.itemDetailText}>Preferred Time: {item.preferredTime}</Text>
                        )}
                        {item.notes && (
                          <Text style={styles.itemDetailText} numberOfLines={2}>
                            Notes: {item.notes}
                          </Text>
                        )}
                      </>
                    )}

                    {item.service?.toLowerCase() === 'rental' && (
                      <>
                        {!item.isBundle && item.garmentType && (
                          <Text style={styles.itemDetailText}>
                            {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.garmentType}
                          </Text>
                        )}
                        {item.rentalStartDate && item.rentalEndDate && (
                          <Text style={styles.itemDetailText}>
                            Rental: {new Date(item.rentalStartDate).toLocaleDateString()} - {new Date(item.rentalEndDate).toLocaleDateString()}
                          </Text>
                        )}
                      </>
                    )}
                    {item.service?.toLowerCase() === 'rental' ? (
                      <>
                        <Text style={styles.itemPrice}>
                          Rental Price: ₱{item.price.toLocaleString()}
                        </Text>
                        {item.downpayment > 0 && (
                          <Text style={styles.itemPriceSmall}>
                            Downpayment: ₱{item.downpayment.toLocaleString()}
                          </Text>
                        )}
                      </>
                    ) : item.service?.toLowerCase() === 'dry_cleaning' && item.isEstimatedPrice ? (
                      <Text style={styles.itemPricePending}>
                        Estimated Price: ₱{item.price.toLocaleString()}
                      </Text>
                    ) : item.service?.toLowerCase() === 'dry_cleaning' ? (
                      <Text style={styles.itemPrice}>
                        Final Price: ₱{item.price.toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={styles.itemPricePending}>
                        Estimated Price: ₱{item.price.toLocaleString()}
                      </Text>
                    )}
                    {item.isBundle ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setBundleItems(item.bundleItems || []);
                          setShowBundleModal(true);
                        }}
                        style={styles.viewDetailsLink}
                      >
                        <Text style={styles.viewDetailsLinkText}>
                          View Bundle Items
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color="#94665B"
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          showItemDetails(item);
                        }}
                        style={styles.viewDetailsLink}
                      >
                        <Text style={styles.viewDetailsLinkText}>
                          View Details
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color="#94665B"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(item.id);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected Items</Text>
                <Text style={styles.summaryValue}>{selectedItems.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  ₱{getSelectedTotal().toLocaleString()}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  ₱{getSelectedTotal().toLocaleString()}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModalContent}>
            <View style={styles.detailsModalHeader}>
              <Text style={styles.detailsModalTitle}>Service Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Ionicons name="close" size={28} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedItemDetails && (
                <>
                  {/* For rental items, show 4-image carousel (front, back, side, main) */}
                  {selectedItemDetails.service?.toLowerCase() === 'rental' && (() => {
                    const rentalImages = [
                      { url: selectedItemDetails.frontImage, label: 'Front' },
                      { url: selectedItemDetails.backImage, label: 'Back' },
                      { url: selectedItemDetails.sideImage, label: 'Side' },
                      { url: selectedItemDetails.image, label: 'Main' },
                    ].filter(img => img.url && img.url.trim() !== '' && img.url !== 'no-image');

                    if (rentalImages.length > 0) {
                      return (
                        <RentalImageCarousel
                          images={rentalImages}
                          itemName={selectedItemDetails.item || 'Rental Item'}
                          imageHeight={250}
                          showFullscreen={true}
                        />
                      );
                    }
                    return null;
                  })()}
                  {/* For customization with angle images, show 4 views at top */}
                  {(selectedItemDetails.service?.toLowerCase() === 'customization' || selectedItemDetails.service?.toLowerCase() === 'customize') &&
                   selectedItemDetails.designData?.angleImages ? (
                    <View style={styles.topAngleImagesContainer}>
                      <View style={styles.angleImagesGrid}>
                        {['front', 'back', 'right', 'left'].map((angle) => (
                          selectedItemDetails.designData.angleImages[angle] && (
                            <View key={angle} style={styles.angleImageContainer}>
                              <Image
                                source={{ uri: selectedItemDetails.designData.angleImages[angle] }}
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
                  ) : selectedItemDetails.service?.toLowerCase() !== 'rental' && selectedItemDetails.imageUrls && selectedItemDetails.imageUrls.length > 0 ? (
                    <>
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: selectedItemDetails.imageUrls[currentImageIndex] }}
                          style={styles.detailsImage}
                          onError={(error) => {
                            console.log('Image load error:', error);
                          }}
                        />
                        {selectedItemDetails.imageUrls.length > 1 && (
                          <>
                            <TouchableOpacity
                              style={{ position: 'absolute', left: 10, top: '50%', transform: [{ translateY: -16 }], backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}
                              onPress={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedItemDetails.imageUrls.length - 1)}
                            >
                              <Ionicons name="chevron-back" size={20} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ position: 'absolute', right: 10, top: '50%', transform: [{ translateY: -16 }], backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}
                              onPress={() => setCurrentImageIndex(prev => prev < selectedItemDetails.imageUrls.length - 1 ? prev + 1 : 0)}
                            >
                              <Ionicons name="chevron-forward" size={20} color="white" />
                            </TouchableOpacity>
                            <View style={{ position: 'absolute', bottom: 10, left: '50%', transform: [{ translateX: -25 }], backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                              <Text style={{ color: 'white', fontSize: 12 }}>{currentImageIndex + 1} / {selectedItemDetails.imageUrls.length}</Text>
                            </View>
                          </>
                        )}
                      </View>
                      <View style={styles.detailsSection}>
                        <Text style={styles.detailsImageLabel}>
                          {selectedItemDetails.service?.toLowerCase() === 'repair' ? `${selectedItemDetails.imageUrls.length} damage photo${selectedItemDetails.imageUrls.length > 1 ? 's' : ''} uploaded` :
                           selectedItemDetails.service?.toLowerCase() === 'dry_cleaning' ? `${selectedItemDetails.imageUrls.length} clothing photo${selectedItemDetails.imageUrls.length > 1 ? 's' : ''} uploaded` :
                           `${selectedItemDetails.imageUrls.length} photo${selectedItemDetails.imageUrls.length > 1 ? 's' : ''} uploaded`}
                        </Text>
                      </View>
                    </>
                  ) : selectedItemDetails.service?.toLowerCase() !== 'rental' && selectedItemDetails.image && selectedItemDetails.image !== 'no-image' && selectedItemDetails.image.trim() !== '' && !selectedItemDetails.image.includes('no-image') ? (
                    <>
                      <Image
                        source={{ uri: selectedItemDetails.image }}
                        style={styles.detailsImage}
                        onError={(error) => {
                          console.log('Image load error:', error);
                          console.log('Failed to load image URL:', selectedItemDetails.image);
                        }}
                        onLoad={() => console.log('Image loaded successfully:', selectedItemDetails.image)}
                      />
                      <View style={styles.detailsSection}>
                        <Text style={styles.detailsImageLabel}>
                          {selectedItemDetails.service?.toLowerCase() === 'repair' ? 'Damage photo uploaded' :
                           selectedItemDetails.service?.toLowerCase() === 'dry_cleaning' ? 'Clothing photo uploaded' :
                           'Photo uploaded'}
                        </Text>
                      </View>
                    </>
                  ) : selectedItemDetails.service?.toLowerCase() !== 'rental' ? (
                    <View style={[styles.detailsImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
                      <Text style={{ color: '#666' }}>No image available</Text>
                    </View>
                  ) : null}

                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>Service</Text>
                    <Text style={styles.detailsValue}>
                      {getServiceTypeDisplay(selectedItemDetails.service)}
                    </Text>
                  </View>

                  {selectedItemDetails.serviceId && (
                    <View style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Service ID</Text>
                      <Text style={styles.detailsValue}>
                        {selectedItemDetails.serviceId}
                      </Text>
                    </View>
                  )}
                  {selectedItemDetails.service?.toLowerCase() === 'repair' && (
                    <>
                      {/* Multiple garments support */}
                      {selectedItemDetails.garments && selectedItemDetails.garments.length > 0 ? (
                        <>
                          {selectedItemDetails.garments.map((garment: any, idx: number) => (
                            <View key={idx} style={styles.garmentCard}>
                              <View style={styles.garmentCardHeader}>
                                <Text style={styles.garmentCardTitle}>Garment {idx + 1}</Text>
                              </View>
                              <View style={styles.garmentCardRow}>
                                <Text style={styles.garmentCardLabel}>Type:</Text>
                                <Text style={styles.garmentCardValue}>{garment.garmentType}</Text>
                              </View>
                              <View style={styles.garmentCardRow}>
                                <Text style={styles.garmentCardLabel}>Damage Level:</Text>
                                <Text style={styles.garmentCardValue}>{garment.damageLevel}</Text>
                              </View>
                              {garment.notes && (
                                <View style={styles.garmentCardRow}>
                                  <Text style={styles.garmentCardLabel}>Description:</Text>
                                  <Text style={styles.garmentCardValue}>{garment.notes}</Text>
                                </View>
                              )}
                              <View style={styles.garmentCardRow}>
                                <Text style={styles.garmentCardLabel}>Price:</Text>
                                <Text style={styles.garmentCardValue}>₱{garment.basePrice}</Text>
                              </View>
                            </View>
                          ))}
                        </>
                      ) : (
                        <>
                          {selectedItemDetails.damageType && (
                            <View style={styles.detailsSection}>
                              <Text style={styles.detailsLabel}>Damage Level</Text>
                              <Text style={styles.detailsValue}>
                                {selectedItemDetails.damageType}
                              </Text>
                            </View>
                          )}
                          {selectedItemDetails.garmentType && (
                            <View style={styles.detailsSection}>
                              <Text style={styles.detailsLabel}>Garment</Text>
                              <Text style={styles.detailsValue}>
                                {selectedItemDetails.garmentType}
                              </Text>
                            </View>
                          )}
                          {selectedItemDetails.damageDescription && (
                            <View style={styles.detailsSection}>
                              <Text style={styles.detailsLabel}>Description</Text>
                              <Text style={styles.detailsValue}>
                                {selectedItemDetails.damageDescription}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                      {selectedItemDetails.appointmentDate && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Drop off preferred date</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.appointmentDate}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  {selectedItemDetails.service?.toLowerCase() === 'dry_cleaning' && (
                    <>
                      {/* Multiple garments support */}
                      {selectedItemDetails.garments && selectedItemDetails.garments.length > 0 ? (
                        <>
                          {selectedItemDetails.garments.map((garment: any, idx: number) => (
                            <View key={idx} style={styles.garmentCard}>
                              <View style={styles.garmentCardHeader}>
                                <Text style={styles.garmentCardTitle}>Garment {idx + 1}</Text>
                              </View>
                              <View style={styles.garmentCardRow}>
                                <Text style={styles.garmentCardLabel}>Type:</Text>
                                <Text style={styles.garmentCardValue}>{garment.garmentType}</Text>
                              </View>
                              {garment.brand && (
                                <View style={styles.garmentCardRow}>
                                  <Text style={styles.garmentCardLabel}>Brand:</Text>
                                  <Text style={styles.garmentCardValue}>{garment.brand}</Text>
                                </View>
                              )}
                              <View style={styles.garmentCardRow}>
                                <Text style={styles.garmentCardLabel}>Quantity:</Text>
                                <Text style={styles.garmentCardValue}>{garment.quantity}</Text>
                              </View>
                              <View style={styles.garmentCardRow}>
                                <Text style={styles.garmentCardLabel}>Price:</Text>
                                <Text style={styles.garmentCardValue}>₱{garment.pricePerItem * garment.quantity}</Text>
                              </View>
                            </View>
                          ))}
                        </>
                      ) : (
                        <>
                          {selectedItemDetails.garmentType && (
                            <View style={styles.detailsSection}>
                              <Text style={styles.detailsLabel}>Garment Type</Text>
                              <Text style={styles.detailsValue}>
                                {selectedItemDetails.garmentType.charAt(0).toUpperCase() + selectedItemDetails.garmentType.slice(1)}
                              </Text>
                            </View>
                          )}
                          {selectedItemDetails.clothingBrand && (
                            <View style={styles.detailsSection}>
                              <Text style={styles.detailsLabel}>Brand</Text>
                              <Text style={styles.detailsValue}>
                                {selectedItemDetails.clothingBrand}
                              </Text>
                            </View>
                          )}
                          {selectedItemDetails.quantity > 0 && (
                            <View style={styles.detailsSection}>
                              <Text style={styles.detailsLabel}>Quantity</Text>
                              <Text style={styles.detailsValue}>
                                {selectedItemDetails.quantity} items
                              </Text>
                            </View>
                          )}
                          {selectedItemDetails.pricePerItem && (
                            <View style={styles.detailsSection}>
                              <Text style={styles.detailsLabel}>Price per item</Text>
                              <Text style={styles.detailsValue}>
                                ₱{parseFloat(selectedItemDetails.pricePerItem).toFixed(2)}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                      {selectedItemDetails.appointmentDate && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Drop off date</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.appointmentDate}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  {(selectedItemDetails.service?.toLowerCase() === 'customization' || selectedItemDetails.service?.toLowerCase() === 'customize') && (
                    <>
                      {selectedItemDetails.garmentType && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Garment Type</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.garmentType}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.fabricType && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Fabric Type</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.fabricType}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.preferredDate && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Preferred Date</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.preferredDate}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.preferredTime && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Preferred Time</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.preferredTime}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.notes && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Notes</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.notes}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.designData && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>3D Customization Details</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.designData.size && `Size: ${selectedItemDetails.designData.size.charAt(0).toUpperCase() + selectedItemDetails.designData.size.slice(1)}\n`}
                            {selectedItemDetails.designData.fit && `Fit: ${selectedItemDetails.designData.fit.charAt(0).toUpperCase() + selectedItemDetails.designData.fit.slice(1)}\n`}
                            {selectedItemDetails.designData.colors?.fabric && `Color: ${selectedItemDetails.designData.colors.fabric}\n`}
                            {selectedItemDetails.designData.pattern && selectedItemDetails.designData.pattern !== 'none' && `Pattern: ${selectedItemDetails.designData.pattern.charAt(0).toUpperCase() + selectedItemDetails.designData.pattern.slice(1)}\n`}
                            {selectedItemDetails.designData.personalization?.initials && `Personalization: ${selectedItemDetails.designData.personalization.initials}\n`}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  {selectedItemDetails.service?.toLowerCase() === 'rental' && (
                    <>
                      {selectedItemDetails.isBundle && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Bundle</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.bundleItems?.length || 0} items
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.rentalItemName && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Item Name</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.rentalItemName}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.rentalBrand && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Brand</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.rentalBrand}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.rentalCategory && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Category</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.rentalCategory}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.rentalSize && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Size Details</Text>
                          <View style={styles.sizeContainer}>
                            {(() => {
                              const sizeData = formatSize(selectedItemDetails.rentalSize);
                              if (sizeData && Array.isArray(sizeData)) {
                                return sizeData.map((measurement, idx) => (
                                  <View key={idx} style={styles.sizeRow}>
                                    <Text style={styles.sizeLabel}>{measurement.label}:</Text>
                                    <Text style={styles.sizeValue}>{measurement.value}</Text>
                                  </View>
                                ));
                              }
                              return <Text style={styles.detailsValue}>N/A</Text>;
                            })()}
                          </View>
                        </View>
                      )}
                      {selectedItemDetails.rentalColor && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Color</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.rentalColor}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.rentalMaterial && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Fabric/Material</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.rentalMaterial}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.rentalDescription && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Description</Text>
                          <Text style={styles.detailsValue}>
                            {selectedItemDetails.rentalDescription}
                          </Text>
                        </View>
                      )}
                      {selectedItemDetails.rentalStartDate && selectedItemDetails.rentalEndDate && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsLabel}>Rental Period</Text>
                          <Text style={styles.detailsValue}>
                            {new Date(selectedItemDetails.rentalStartDate).toLocaleDateString()} - {new Date(selectedItemDetails.rentalEndDate).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>
                      {selectedItemDetails.service?.toLowerCase() === 'rental' ? 'Rental Price' :
                       selectedItemDetails.service?.toLowerCase() === 'dry_cleaning' && selectedItemDetails.isEstimatedPrice ? 'Estimated Price' :
                       selectedItemDetails.service?.toLowerCase() === 'dry_cleaning' ? 'Final Price' : 'Estimated Price'}
                    </Text>
                    <Text style={styles.detailsPriceValue}>
                      ₱{(selectedItemDetails.price || 0).toLocaleString()}
                    </Text>
                  </View>

                  {selectedItemDetails.service?.toLowerCase() === 'rental' && (selectedItemDetails.downpayment || 0) > 0 && (
                    <View style={styles.detailsSection}>
                      <Text style={styles.detailsLabel}>Downpayment</Text>
                      <Text style={styles.detailsPriceValue}>
                        ₱{(selectedItemDetails.downpayment || 0).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </>
              )}
              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showBundleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBundleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bundleModalContent}>
            <View style={styles.bundleModalHeader}>
              <Text style={styles.bundleModalTitle}>Rental Bundle Items</Text>
              <TouchableOpacity onPress={() => setShowBundleModal(false)}>
                <Ionicons name="close" size={28} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.bundleModalScroll}>
              <View style={styles.bundleItemsGrid}>
                {bundleItems.map((bundleItem: any, index: number) => {
                  const imageUrl = bundleItem.image_url || bundleItem.imageUrl;
                  const API_BASE = API_BASE_URL.replace('/api', '');
                  const fullImageUrl = imageUrl && imageUrl !== 'no-image'
                    ? (imageUrl.startsWith('http') ? imageUrl : `${API_BASE}${imageUrl}`)
                    : null;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.bundleItemCard}
                      onPress={() => {
                        const API_BASE = API_BASE_URL.replace('/api', '');
                        const getFullImageUrl = (img: string | undefined) => {
                          if (!img || img === 'no-image') return null;
                          return img.startsWith('http') ? img : `${API_BASE}${img}`;
                        };
                        
                        setSelectedItemDetails({
                          ...bundleItem,
                          image: fullImageUrl,
                          frontImage: getFullImageUrl(bundleItem.front_image),
                          backImage: getFullImageUrl(bundleItem.back_image),
                          sideImage: getFullImageUrl(bundleItem.side_image),
                          service: 'rental',
                          price: bundleItem.individual_cost || bundleItem.price || 0,
                          downpayment: bundleItem.downpayment || 0,
                          item: bundleItem.item_name || bundleItem.name || 'Rental Item',
                          garmentType: bundleItem.item_name || bundleItem.name || '',
                          rentalItemName: bundleItem.item_name || bundleItem.name || '',
                          rentalBrand: bundleItem.brand || '',
                          rentalCategory: bundleItem.category || '',
                          rentalSize: bundleItem.size || '',
                          rentalColor: bundleItem.color || '',
                          rentalMaterial: bundleItem.material || '',
                          rentalDescription: bundleItem.description || '',
                        });
                        setShowBundleModal(false);
                        setShowDetailsModal(true);
                      }}
                    >
                      {fullImageUrl ? (
                        <Image
                          source={{ uri: fullImageUrl }}
                          style={styles.bundleItemImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.bundleItemImage, styles.bundleItemImagePlaceholder]}>
                          <Ionicons name="shirt-outline" size={40} color="#9CA3AF" />
                        </View>
                      )}
                      <Text style={styles.bundleItemName} numberOfLines={2}>
                        {bundleItem.item_name || bundleItem.name || 'Rental Item'}
                      </Text>
                      {bundleItem.brand && (
                        <Text style={styles.bundleItemBrand}>{bundleItem.brand}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="calendar-outline" size={48} color="#94665B" />
            </View>
            <Text style={styles.modalTitle}>Confirm Booking</Text>
            <Text style={styles.modalText}>
              You are booking {selectedItems.length} service
              {selectedItems.length > 1 ? "s" : ""}
            </Text>

            <View style={{ width: "100%", marginVertical: 16 }}>
              {cartItems
                .filter((item) => selectedItems.includes(item.id))
                .map((item) => (
                  <Text key={item.id} style={styles.modalItemDate}>
                    • {item.item}: {item.appointmentDate || "No date set"}
                  </Text>
                ))}
            </View>

            <View style={styles.modalTotal}>
              <Text style={styles.modalTotalLabel}>Total Amount:</Text>
              <Text style={styles.modalTotalValue}>
                ₱{getSelectedTotal().toLocaleString()}
              </Text>
            </View>
            <View style={styles.orderNotesContainer}>
              <Text style={styles.orderNotesLabel}>Order Notes (Optional)</Text>
              <TextInput
                style={styles.orderNotesInput}
                placeholder="Add any special instructions..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={orderNotes}
                onChangeText={setOrderNotes}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowConfirmModal(false);
                  setOrderNotes('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, loading && styles.modalConfirmButtonDisabled]}
                onPress={confirmBooking}
                disabled={loading}
              >
                <Text style={styles.modalConfirmText}>
                  {loading ? 'Submitting...' : 'Submit Order'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {cartItems.length > 0 && (
        <View style={styles.checkoutContainer}>
          <View style={styles.checkoutInfo}>
            <Text style={styles.checkoutLabel}>
              {selectedItems.length}{" "}
              {selectedItems.length === 1 ? "item" : "items"} selected
            </Text>
            <Text style={styles.checkoutTotal}>
              ₱
              {getSelectedTotal().toLocaleString()}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.checkoutButton,
              selectedItems.length === 0 && styles.checkoutButtonDisabled,
            ]}
            onPress={handleCheckout}
            disabled={selectedItems.length === 0}
          >
            <Text style={styles.checkoutButtonText}>Book Appointment</Text>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
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

        <View style={styles.navItemWrapActive}>
          <Ionicons name="cart" size={20} color="#7A5A00" />
        </View>

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
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1F2937" },
  selectAllText: { fontSize: 15, fontWeight: "600", color: "#94665B" },
  emptyCart: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyCartText: {
    fontSize: 20,
    color: "#6B7280",
    marginTop: 20,
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: "#94665B",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 30,
  },
  shopButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cartList: { paddingHorizontal: 20, paddingTop: 10 },
  cartItem: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cartItemSelected: { borderColor: "#94665B", backgroundColor: "#FDF4F0" },
  checkboxContainer: { marginRight: 16 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: "#94665B", borderColor: "#94665B" },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FDF4F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  itemDetails: { flex: 1 },
  serviceType: {
    fontSize: 13,
    color: "#94665B",
    fontWeight: "600",
    marginBottom: 4,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 6,
  },
  itemGarment: {
    fontSize: 14,
    color: "#94665B",
    fontWeight: "500",
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 6,
  },
  appointmentTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF4F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  appointmentText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#94665B",
    fontWeight: "600",
  },
  viewDetailsLink: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  viewDetailsLinkText: {
    fontSize: 13,
    color: "#94665B",
    fontWeight: "600",
    marginRight: 4,
  },
  serviceIdText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  itemDetailText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
    lineHeight: 18,
  },
  itemPrice: { fontSize: 16, fontWeight: "700", color: "#94665B", marginTop: 4 },
  itemPriceSmall: { fontSize: 14, fontWeight: "600", color: "#94665B", marginTop: 2 },
  itemPricePending: { fontSize: 14, fontWeight: "600", color: "#F59E0B", fontStyle: "italic", marginTop: 4 },
  removeButton: { padding: 10 },
  cancelButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600"
  },

  summarySection: {
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
    marginTop: 10,
    marginBottom: 100,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 16, color: "#6B7280" },
  summaryValue: { fontSize: 16, fontWeight: "600", color: "#1F2937" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },
  totalLabel: { fontSize: 20, fontWeight: "800", color: "#1F2937" },
  totalValue: { fontSize: 26, fontWeight: "800", color: "#94665B" },

  checkoutContainer: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  checkoutInfo: { marginBottom: 16 },
  checkoutLabel: { fontSize: 15, color: "#6B7280" },
  checkoutTotal: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1F2937",
    marginTop: 4,
  },
  checkoutButton: {
    backgroundColor: "#94665B",
    borderRadius: 20,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  checkoutButtonDisabled: { backgroundColor: "#D1D5DB" },
  checkoutButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginRight: 10,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FDF4F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
  },
  modalText: {
    fontSize: 17,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  modalTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "#F9FAFB",
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  modalTotalLabel: { fontSize: 18, color: "#6B7280" },
  modalTotalValue: { fontSize: 28, fontWeight: "800", color: "#94665B" },
  modalButtons: { flexDirection: "row", gap: 16, width: "100%" },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  modalCancelText: { color: "#6B7280", fontWeight: "600", fontSize: 17 },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: "#94665B",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  modalConfirmButtonDisabled: { opacity: 0.6 },
  orderNotesContainer: {
    width: "100%",
    marginBottom: 24,
  },
  orderNotesLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  orderNotesInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 15,
    color: "#1F2937",
    minHeight: 80,
    textAlignVertical: "top",
  },

  detailsModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: height * 0.88,
    width: "100%",
    marginTop: "auto",
  },
  detailsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailsModalTitle: { fontSize: 22, fontWeight: "700", color: "#1F2937" },
  detailsImage: { width: "100%", height: 250, resizeMode: "cover" },
  detailsImageLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
  },
  detailsSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
  },
  detailsValue: { fontSize: 17, color: "#1F2937", fontWeight: "500" },
  detailsPriceValue: { fontSize: 24, fontWeight: "800", color: "#94665B" },

  // Size measurement styles (matching web styling)
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

  // Garment card styles
  garmentCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  garmentCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  garmentCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  garmentCardRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  garmentCardLabel: {
    fontSize: 14,
    color: "#6B7280",
    width: 100,
  },
  garmentCardValue: {
    fontSize: 14,
    color: "#1F2937",
    flex: 1,
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
  modalItemDate: {
    fontSize: 15,
    color: "#4B5563",
    marginVertical: 4,
    textAlign: "left",
  },

  bundleBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007bff',
    marginBottom: 4,
  },
  rentalImageThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
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
  bundleModalScroll: {
    padding: 20,
  },
  bundleItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  bundleItemCard: {
    width: (width - 80) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bundleItemImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#F9FAFB',
  },
  bundleItemImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bundleItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    padding: 12,
    paddingBottom: 4,
  },
  bundleItemBrand: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  angleImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
});
