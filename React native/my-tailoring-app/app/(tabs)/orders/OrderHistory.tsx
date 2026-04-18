
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { orderTrackingService } from "../../../utils/apiService";

const { width } = Dimensions.get("window");

interface OrderItem {
  order_item_id: number;
  parent_order_id?: number;
  child_order_id?: number;
  service_type: string;
  status: string;
  base_price: string;
  final_price: string;
  specific_data: any;
}

interface OrderData {
  order_id: number;
  parent_order_id?: number;
  order_date: string;
  items: OrderItem[];
}

export default function OrderHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const result = await orderTrackingService.getUserOrderTracking();
      if (result.success && result.data) {
        const normalizedOrders = result.data.map((order: OrderData) => ({
          ...order,
          parent_order_id: order.parent_order_id || order.order_id,
          items: (order.items || []).map((item: OrderItem) => ({
            ...item,
            parent_order_id: item.parent_order_id || order.parent_order_id || order.order_id,
            child_order_id: item.child_order_id || item.order_item_id,
            order_item_id: item.order_item_id || item.child_order_id || item.order_item_id,
            order_date: order.order_date,
            order_id: order.order_id
          }))
        })).sort((a: any, b: any) => {
          const aDate = new Date(a.order_date || a.created_at || a.updated_at || 0).getTime();
          const bDate = new Date(b.order_date || b.created_at || b.updated_at || 0).getTime();
          return bDate - aDate;
        });
        setOrders(normalizedOrders as any);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filters = [
    "All",
    "Pending",
    "In Progress",
    "Ready",
    "Completed",
    "Cancelled",
  ];

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "in_progress":
      case "processing":
        return "#3B82F6";
      case "completed":
        return "#10B981";
      case "ready_to_pickup":
      case "ready":
        return "#F59E0B";
      case "cancelled":
        return "#EF4444";
      case "pending":
        return "#8B5CF6";
      case "price_confirmation":
        return "#F97316";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "in_progress":
      case "processing":
        return "time-outline";
      case "completed":
        return "checkmark-circle-outline";
      case "ready_to_pickup":
      case "ready":
        return "basket-outline";
      case "cancelled":
        return "close-circle-outline";
      case "pending":
        return "hourglass-outline";
      case "price_confirmation":
        return "pricetag-outline";
      default:
        return "ellipse-outline";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "pending": return "Pending";
      case "in_progress": return "In Progress";
      case "processing": return "Processing";
      case "ready_to_pickup": return "Ready to Pick Up";
      case "ready": return "Ready";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      case "price_confirmation": return "Price Confirmation";
      default: return status;
    }
  };

  const matchesFilter = (status: string, filter: string) => {
    if (filter === "All") return true;
    const statusLower = status?.toLowerCase();
    const filterLower = filter.toLowerCase().replace(/ /g, '_');

    if (filter === "In Progress") {
      return statusLower === "in_progress" || statusLower === "processing";
    }
    if (filter === "Ready") {
      return statusLower === "ready_to_pickup" || statusLower === "ready";
    }
    return statusLower === filterLower;
  };

  const filteredOrders = orders.filter((order: any) =>
    (order.items || []).some((item: any) => matchesFilter(item.status, selectedFilter))
  );

  const stats = {
    total: orders.reduce((count, order: any) => count + (order.items || []).length, 0),
    active: orders.reduce((count, order: any) => count + (order.items || []).filter((item: any) => item.status?.toLowerCase() === "pending" || item.status?.toLowerCase() === "in_progress").length, 0),
    completed: orders.reduce((count, order: any) => count + (order.items || []).filter((item: any) => item.status?.toLowerCase() === "completed").length, 0),
    toPickup: orders.reduce((count, order: any) => count + (order.items || []).filter((item: any) => item.status?.toLowerCase() === "ready_to_pickup" || item.status?.toLowerCase() === "ready").length, 0),
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderOrder = ({ item }: { item: any }) => {
    const visibleItems = (item.items || []).filter((child: any) => matchesFilter(child.status, selectedFilter));

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNo}>Parent Order #{item.parent_order_id || item.order_id}</Text>
            <Text style={styles.orderDate}>{formatDate(item.order_date)} · {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}</Text>
          </View>
        </View>

        {visibleItems.map((child: any) => (
          <TouchableOpacity
            key={`${item.order_id}-${child.child_order_id || child.order_item_id}`}
            style={styles.childOrderCard}
            onPress={() => router.push(`/orders/${child.child_order_id || child.order_item_id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.orderContent}>
              <View style={styles.serviceIconContainer}>
                <Ionicons
                  name={
                    child.service_type === "customize"
                      ? "shirt-outline"
                      : child.service_type === "rental"
                      ? "business-outline"
                      : child.service_type === "repair"
                      ? "construct-outline"
                      : "water-outline"
                  }
                  size={32}
                  color="#94665B"
                />
              </View>

              <View style={styles.orderDetails}>
                <Text style={styles.orderService}>
                  {child.service_type?.charAt(0).toUpperCase() + child.service_type?.slice(1).replace('_', ' ')} Service
                </Text>
                <Text style={styles.orderItem}>
                  Child Order #{child.child_order_id || child.order_item_id}
                </Text>
                <Text style={styles.orderItem}>
                  {child.specific_data?.serviceName || child.specific_data?.garmentType || 'Service Item'}
                </Text>
                {child.specific_data?.specialInstructions && (
                  <Text style={styles.orderDescription} numberOfLines={2}>
                    {child.specific_data.specialInstructions}
                  </Text>
                )}
                {child.specific_data?.pickupDate && child.status?.toLowerCase() !== "completed" && (
                  <View style={styles.estimated}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.estimatedText}>
                      Pickup: {formatDate(child.specific_data.pickupDate)}
                    </Text>
                  </View>
                )}
              </View>
              {(child.service_type === 'customize' || child.service_type === 'customization') && (
               child.specific_data?.garmentType?.toLowerCase() === 'uniform' ||
               child.specific_data?.isUniform === true ||
               child.pricing_factors?.isUniform === true
              ) ? (
                parseFloat(child.final_price || child.base_price || '0') === 0 ? (
                  <Text style={[styles.orderPrice, { color: '#e65100' }]}>Price varies</Text>
                ) : (
                  <Text style={[styles.orderPrice, { color: '#4caf50' }]}>₱{parseFloat(child.final_price || child.base_price || '0').toLocaleString()}</Text>
                )
              ) : (
                <Text style={styles.orderPrice}>₱{parseFloat(child.final_price || child.base_price || '0').toLocaleString()}</Text>
              )}
            </View>

            <View style={styles.orderActions}>
              <TouchableOpacity
                style={styles.transactionLogButton}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({
                    pathname: "/(tabs)/orders/TransactionLog",
                    params: { orderItemId: (child.child_order_id || child.order_item_id)?.toString() },
                  });
                }}
              >
                <Ionicons name="receipt-outline" size={16} color="#8B4513" />
                <Text style={styles.transactionLogButtonText}>Transaction Log</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({
                    pathname: "/(tabs)/orders/[id]",
                    params: { id: (child.child_order_id || child.order_item_id)?.toString() },
                  });
                }}
              >
                <Text style={styles.actionText}>View Details</Text>
                <Ionicons name="chevron-forward" size={16} color="#94665B" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace("../UserProfile/profile")}
          >
            <Ionicons name="arrow-back" size={26} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Order History</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#94665B" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace("../UserProfile/profile")}
        >
          <Ionicons name="arrow-back" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Order History</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
      >
        {filters.map((f) => {
          const count =
            f === "All"
              ? orders.reduce((count, order: any) => count + (order.items || []).length, 0)
              : orders.reduce((count, order: any) => count + (order.items || []).filter((item: any) => matchesFilter(item.status, f)).length, 0);
          const isActive = selectedFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, isActive && styles.activeTab]}
              onPress={() => setSelectedFilter(f)}
            >
              <Text style={[styles.filterText, isActive && styles.activeText]}>
                {f}
              </Text>
              {count > 0 && (
                <View style={[styles.badge, isActive && styles.activeBadge]}>
                  <Text
                    style={[
                      styles.badgeText,
                      isActive && styles.activeBadgeText,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <FlatList
        data={filteredOrders}
        keyExtractor={(item: any) => `parent-${item.parent_order_id || item.order_id}`}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={80} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === "All"
                ? "Your orders will appear here"
                : `No ${selectedFilter.toLowerCase()} orders`}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity onPress={() => router.replace("/home")}>
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

        <TouchableOpacity onPress={() => router.push("/(tabs)/UserProfile/profile")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="person-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 10 : 30,
    paddingBottom: 16,
    backgroundColor: "#fff",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1F2937", margin: "auto" },

  statsRow: { paddingLeft: 20, marginVertical: 16 },
  statCard: {
    width: 120,
    height: 100,
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statBig: { fontSize: 32, fontWeight: "800", marginVertical: 4 },
  statLabel: { fontSize: 13, color: "#4B5563" },

  filterRow: {
    paddingLeft: width * 0.05,
    paddingBottom: 16,
    maxHeight: 60,
  },

  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    height: 40,
  },

  activeTab: {
    backgroundColor: "#94665B",
    borderColor: "#94665B",
  },

  filterText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563",
  },

  activeFilterText: {
    color: "#FFFFFF",
  },
  activeText: { color: "#fff" },
  badge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  activeBadge: { backgroundColor: "rgba(255,255,255,0.2)" },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#1F2937" },
  activeBadgeText: { color: "#fff" },

  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  childOrderCard: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3E4DF",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  orderNo: { fontSize: 17, fontWeight: "700", color: "#1F2937" },
  orderDate: { fontSize: 13, color: "#9CA3AF", marginTop: 4 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: { fontSize: 13, fontWeight: "600" },

  orderContent: { flexDirection: "row", alignItems: "center" },
  serviceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FDF4F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  orderDetails: { flex: 1 },
  orderService: { fontSize: 15, fontWeight: "700", color: "#94665B" },
  orderItem: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 4,
  },
  orderDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 18,
  },
  estimated: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  estimatedText: { fontSize: 13, color: "#6B7280" },
  orderPrice: { fontSize: 22, fontWeight: "800", color: "#94665B" },

  orderActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    gap: 12,
  },
  transactionLogButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4E6",
    paddingVertical: 12,
    borderRadius: 16,
    gap: 6,
  },
  transactionLogButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8B4513",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDF4F0",
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  actionText: { fontSize: 15, fontWeight: "600", color: "#94665B" },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
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
});
