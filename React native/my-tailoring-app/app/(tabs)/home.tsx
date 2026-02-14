import * as React from "react";
import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView , useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { LinearGradient } from "expo-linear-gradient";
import { rentalService } from "../../utils/rentalService";
import { notificationService } from "../../utils/apiService";

const { height, width } = Dimensions.get("window");

const services = [
  {
    id: "s1",
    label: "Rental",
    icon: require("../../assets/images/rental.jpg"),
  },
  {
    id: "s2",
    label: "Customize",
    icon: require("../../assets/images/customize.jpg"),
  },
  {
    id: "s3",
    label: "Repair",
    icon: require("../../assets/images/repair.jpg"),
  },
  {
    id: "s4",
    label: "Dry Cleaning",
    icon: require("../../assets/images/dry.jpg"),
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rentals, setRentals] = useState<any[]>([]);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchRentals();
    fetchUnreadCount();
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const result = await notificationService.getUnreadCount();
      if (result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchRentals = async () => {
    try {
      setLoadingRentals(true);
      const result = await rentalService.getAvailableRentals();
      
      if (result.items && result.items.length > 0) {
        
        setRentals(result.items.slice(0, 6));
      }
    } catch (err) {
      console.error('Error fetching rentals:', err);
    } finally {
      setLoadingRentals(false);
    }
  };

  const getImageSource = (item: any) => {
    if (item.image_url) {
      const imageUrl = rentalService.getImageUrl(item.image_url);
      if (imageUrl) {
        return { uri: imageUrl };
      }
    }
    return require("../../assets/images/rent.jpg");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View style={styles.greetingRow}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
            />
            <Text style={styles.headerTitle}>Jackman Tailor Deluxe</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileIcon}
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={25} color="black" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.heroContainer}>
          <Image
            source={require("../../assets/images/tailorbackground.jpg")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBadge}>
            <Text style={styles.heroTitle}>Jackman Tailor Deluxe</Text>
            <Text style={styles.heroSubtitle}>Your perfect fit awaits.</Text>
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Our Services</Text>
          <Ionicons name="cut-outline" size={24} color="#991b1b" />
        </View>

        <View style={styles.servicesGrid}>
          {services.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.serviceCard}
              activeOpacity={0.85}
              onPress={() => {
                if (s.id === "s1") router.push("/rental");
                else if (s.id === "s2")
                  router.push("/(tabs)/appointment/CustomizationService");
                else if (s.id === "s3")
                  router.push("/(tabs)/appointment/RepairClothes");
                else if (s.id === "s4")
                  router.push("/(tabs)/appointment/DryCleaning");
              }}
            >
              <LinearGradient
                colors={["rgba(153,27,27,0.08)", "rgba(153,27,27,0.04)"]}
                style={styles.serviceGradient}
              />
              <Image
                source={s.icon}
                style={styles.serviceImage}
                resizeMode="cover"
              />
              <Text style={styles.serviceLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rentals</Text>
          <TouchableOpacity onPress={() => router.push("/rental")}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {loadingRentals ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#991b1b" />
            <Text style={{ marginTop: 12, color: '#6B7280' }}>Loading rentals...</Text>
          </View>
        ) : rentals.length > 0 ? (
          <View style={styles.rentalGrid}>
            {rentals.map((r) => (
              <TouchableOpacity
                key={r.item_id}
                style={styles.rentalCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/rental/${r.item_id}`)}
              >
                <Image
                  source={getImageSource(r)}
                  style={styles.rentalImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.6)"]}
                  style={styles.rentalOverlay}
                />
                <View style={styles.rentalInfo}>
                  <Text style={styles.rentalTitle} numberOfLines={2}>
                    {r.item_name}
                  </Text>
                  <Text style={styles.rentalPrice}>₱{r.daily_rate}/day</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF' }}>No rentals available</Text>
          </View>
        )}
      </ScrollView>
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.navItemWrapActive}>
          <Ionicons name="home" size={20} color="#7A5A00" />
        </View>

        <TouchableOpacity onPress={() => router.push("/(tabs)/orders/OrderHistory")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="receipt-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/faq")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/contact")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="call-outline" size={20} color="#9CA3AF" />
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
  container: { flex: 1, backgroundColor: "#fafafa" },
  logo: { width: 50, height: 50, borderRadius: 50 },
  headerTitle: {
    fontWeight: "600",
    fontSize: width * 0.035,
    color: "#222",
    flex: 1,
    marginLeft: 8,
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 12,
  },
  greetingRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  profileIcon: { padding: 4, position: "relative" },
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
  heroContainer: {
    margin: 20,
    height: height * 0.26,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  heroImage: { width: "100%", height: "100%" },
  heroBadge: { position: "absolute", bottom: 50, left: 20, right: 20 },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#e2e8f0",
    marginTop: 6,
    fontWeight: "500",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: "#1e293b" },
  seeAll: { fontSize: 15, color: "#991b1b", fontWeight: "600" },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  serviceCard: {
    width: width * 0.44,
    height: width * 0.44,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(153,27,27,0.12)",
    shadowColor: "#991b1b",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  serviceGradient: { ...StyleSheet.absoluteFillObject },
  serviceImage: { width: "100%", height: "100%", opacity: 0.92 },
  serviceLabel: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  rentalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  rentalCard: {
    width: width * 0.44,
    height: width * 0.58,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  rentalImage: { width: "100%", height: "100%" },
  rentalOverlay: { ...StyleSheet.absoluteFillObject },
  rentalInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  rentalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 18,
  },
  rentalPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fbbf24",
    marginTop: 4,
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
