
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { transactionLogService } from "../../../utils/apiService";

interface TransactionLog {
  log_id: number;
  order_item_id: number;
  user_id: number;
  transaction_type: string;
  amount: number;
  previous_payment_status: string | null;
  new_payment_status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export default function TransactionLogScreen() {
  const { orderItemId } = useLocalSearchParams<{ orderItemId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (orderItemId) {
      fetchTransactionLogs();
    }
  }, [orderItemId]);

  const fetchTransactionLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await transactionLogService.getTransactionLogsByOrderItem(orderItemId);
      if (result.success) {
        setLogs(result.logs || []);
      } else {
        setError(result.message || "Failed to load transaction logs");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load transaction logs");
      console.error("Error fetching transaction logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTransactionType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      payment: "Payment",
      down_payment: "Down Payment",
      downpayment: "Down Payment",
      final_payment: "Final Payment",
      partial_payment: "Partial Payment",
      refund: "Refund",
      adjustment: "Adjustment",
    };
    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatPaymentStatus = (status: string | null) => {
    if (!status) return "N/A";
    const statusMap: { [key: string]: string } = {
      unpaid: "Unpaid",
      paid: "Paid",
      "down-payment": "Down Payment",
      down_payment: "Down Payment",
      partial_payment: "Partial Payment",
      fully_paid: "Fully Paid",
      cancelled: "Cancelled",
    };
    return statusMap[status] || status.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatPaymentMethod = (method: string | null) => {
    if (!method) return "N/A";
    const methodMap: { [key: string]: string } = {
      system_auto: "System Auto",
      cash: "Cash",
      gcash: "GCash",
      card: "Card",
      bank_transfer: "Bank Transfer",
    };
    return methodMap[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "payment":
      case "final_payment":
        return "#10B981";
      case "down_payment":
        return "#3B82F6";
      case "refund":
        return "#EF4444";
      case "adjustment":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const handleClose = () => {

    if (orderItemId) {
      router.replace(`/(tabs)/orders/${orderItemId}`);
    } else {
      router.replace('/(tabs)/orders/OrderHistory');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction Log</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#94665B" />
          <Text style={styles.loadingText}>Loading transaction logs...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchTransactionLogs}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="receipt-outline" size={60} color="#D1D5DB" />
          <Text style={styles.emptyText}>No transaction logs found</Text>
          <Text style={styles.emptySubtext}>
            Transaction history will appear here once payments are processed
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {logs.map((log) => (
              <View key={log.log_id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {formatTransactionType(log.transaction_type).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.amountValue}>
                    ₱{parseFloat(log.amount.toString()).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.logDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>{formatDate(log.created_at)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Close button at bottom */}
          <View style={styles.footerContainer}>
            <TouchableOpacity style={styles.closeButtonBottom} onPress={handleClose}>
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#94665B",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#94665B",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  logCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeBadge: {
    backgroundColor: "#6B7280",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#94665B",
  },
  logDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#1F2937",
  },
  footerContainer: {
    padding: 20,
    paddingTop: 0,
    alignItems: "flex-end",
  },
  closeButtonBottom: {
    backgroundColor: "#94665B",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

