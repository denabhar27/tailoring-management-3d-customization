
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
  service_type: string;
  status: string;
  base_price: string;
  final_price: string;
  specific_data: any;
}

interface OrderData {
  order_id: number;
  order_date: string;
  items: OrderItem[];
}

export default function OrderHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const result = await orderTrackingService.getUserOrderTracking();
      if (result.success && result.data) {

        const allItems: OrderItem[] = [];
        result.data.forEach((order: OrderData) => {
          order.items.forEach((item: OrderItem) => {
            allItems.push({
              ...item,
              order_date: order.order_date,
              order_id: order.order_id
            } as any);
          });
        });
        setOrders(allItems);
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
    matchesFilter(order.status, selectedFilter)
  );

  const stats = {
    total: orders.length,
    active: orders.filter(
      (o: any) => o.status?.toLowerCase() === "pending" || o.status?.toLowerCase() === "in_progress"
    ).length,
    completed: orders.filter((o: any) => o.status?.toLowerCase() === "completed").length,
    toPickup: orders.filter((o: any) => o.status?.toLowerCase() === "ready_to_pickup" || o.status?.toLowerCase() === "ready").length,
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderOrder = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => router.push(`/orders/${item.order_item_id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNo}>ORD-{item.order_id}</Text>
          <Text style={styles.orderDate}>{formatDate(item.order_date)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + "20" },
          ]}
        >
          <Ionicons
            name={getStatusIcon(item.status) as any}
            size={16}
            color={getStatusColor(item.status)}
          />
          <Text
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.orderContent}>
        <View style={styles.serviceIconContainer}>
          <Ionicons
            name={
              item.service_type === "customize"
                ? "shirt-outline"
                : item.service_type === "rental"
                ? "business-outline"
                : item.service_type === "repair"
                ? "construct-outline"
                : "water-outline"
            }
            size={32}
            color="#94665B"
          />
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.orderService}>
            {item.service_type?.charAt(0).toUpperCase() + item.service_type?.slice(1).replace('_', ' ')} Service
          </Text>
          <Text style={styles.orderItem}>
            {item.specific_data?.serviceName || item.specific_data?.garmentType || 'Service Item'}
          </Text>
          {item.specific_data?.specialInstructions && (
            <Text style={styles.orderDescription} numberOfLines={2}>
              {item.specific_data.specialInstructions}
            </Text>
          )}
          {item.specific_data?.pickupDate && item.status?.toLowerCase() !== "completed" && (
            <View style={styles.estimated}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.estimatedText}>
                Pickup: {formatDate(item.specific_data.pickupDate)}
              </Text>
            </View>
          )}
        </View>
        {(item.service_type === 'customize' || item.service_type === 'customization') && (
         item.specific_data?.garmentType?.toLowerCase() === 'uniform' ||
         item.specific_data?.isUniform === true ||
         item.pricing_factors?.isUniform === true
        ) ? (
          parseFloat(item.final_price || item.base_price || '0') === 0 ? (
            <Text style={[styles.orderPrice, { color: '#e65100' }]}>Price varies</Text>
          ) : (
            <Text style={[styles.orderPrice, { color: '#4caf50' }]}>₱{parseFloat(item.final_price || item.base_price || '0').toLocaleString()}</Text>
          )
        ) : (
          <Text style={styles.orderPrice}>₱{parseFloat(item.final_price || item.base_price || '0').toLocaleString()}</Text>
        )}
      </View>

      <View style={styles.orderActions}>
        <TouchableOpacity
          style={styles.transactionLogButton}
          onPress={(e) => {
            e.stopPropagation();
            router.push({
              pathname: "/(tabs)/orders/TransactionLog",
              params: { orderItemId: item.order_item_id?.toString() || item.id?.toString() },
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
              params: { id: item.order_item_id?.toString() || item.id?.toString() },
            });
          }}
        >
          <Text style={styles.actionText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color="#94665B" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

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
              ? orders.length
              : orders.filter((o: any) => matchesFilter(o.status, f)).length;
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
        keyExtractor={(item: any) => `order-${item.order_item_id || item.id}`}
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
