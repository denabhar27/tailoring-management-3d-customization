
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { cartService } from "../../../utils/apiService";

const { width, height } = Dimensions.get("window");

export default function PreviewOrder() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const orderData = {
    service: "Customize Clothes",
    item: "Suit",
    description: "Custom design with specific pattern and color preferences",
    price: 1200,
    image: null,
    specialInstructions: "Need it by next week for an event",
  };

  const handleAddToCart = async () => {
    setLoading(true);

    try {

      const customizeData = {
        serviceType: 'customize',
        serviceId: 2,
        serviceName: `Custom ${orderData.item}`,
        basePrice: orderData.price.toString(),
        finalPrice: orderData.price.toString(),
        specificData: {
          garmentType: orderData.item,
          specialInstructions: orderData.specialInstructions,
          imageUrl: orderData.image || 'no-image'
        }
      };

      const result = await cartService.addToCart(customizeData);

      if (result.success) {
        Alert.alert("Success!", "Customize service added to cart!", [
          {
            text: "View Cart",
            onPress: () => router.push("/(tabs)/cart/Cart"),
          },
          {
            text: "Continue Shopping",
            onPress: () => router.push("/home"),
          },
        ]);
      } else {
        throw new Error(result.message || "Failed to add customize service to cart");
      }
    } catch (error: any) {
      console.error("Add service error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to add customize service. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview Order</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Service Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Service</Text>
            <Text style={styles.value}>{orderData.service}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Item</Text>
            <Text style={styles.value}>{orderData.item}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Description</Text>
            <Text style={[styles.value, styles.multiline]}>
              {orderData.description}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Special Instructions</Text>
            <Text style={[styles.value, styles.multiline]}>
              {orderData.specialInstructions}
            </Text>
          </View>

          <View style={styles.priceSection}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalPrice}>
              ₱{orderData.price.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.addToCartButton}
          onPress={handleAddToCart}
          disabled={loading}
        >
          <Text style={styles.addToCartText}>
            {loading ? "Adding..." : "Add to Cart"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 24,
    textAlign: "center",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: "#6B7280",
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
    textAlign: "right",
  },
  multiline: {
    textAlign: "right",
    flexWrap: "wrap",
  },
  priceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  totalLabel: {
    fontSize: 18,
    color: "#6B7280",
  },
  totalPrice: {
    fontSize: 28,
    fontWeight: "800",
    color: "#94665B",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  addToCartButton: {
    backgroundColor: "#94665B",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
  },
  addToCartText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
