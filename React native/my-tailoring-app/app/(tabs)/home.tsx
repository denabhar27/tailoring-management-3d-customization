
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
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { rentalService } from "../../utils/rentalService";
import { notificationService } from "../../utils/apiService";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const [rentals, setRentals] = useState<any[]>([]);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {

        router.replace("/");
        return;
      }

      setIsCheckingAuth(false);
      fetchRentals();
      fetchUnreadCount();
    } catch (error) {
      console.error("Error checking auth:", error);
      router.replace("/");
    }
  };

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

  if (isCheckingAuth) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#8B4513" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Scrollable Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        <View style={styles.headerSection}>
          <View style={styles.greetingRow}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
            />
            <View style={styles.brandInfo}>
              <Text style={styles.headerTitle}>Jackman Tailor Deluxe</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={styles.profileIcon}
              onPress={() => router.push("/(tabs)/cart/Cart")}
            >
              <Ionicons name="cart-outline" size={25} color="black" />
            </TouchableOpacity>

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
        </View>

        {/* Hero */}
        <View style={styles.heroContainer}>
          <Image
            source={require("../../assets/images/tailorbackground.jpg")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", "rgba(120,53,15,0.8)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBadge}>
            <Text style={styles.heroTitle}>
              Welcome to Jackman's Tailor Deluxe!
            </Text>
            <View style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Your Perfect Fit Awaits</Text>
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons name="heart" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>Our Services</Text>
            </View>
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
                  else router.push("/(tabs)/appointment/DryCleaning");
                }}
              >
                <View style={styles.serviceImageContainer}>
                  <Image
                    source={s.icon}
                    style={styles.serviceImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(15,23,42,0.92)"]}
                    style={styles.serviceGradient}
                  />
                </View>
                <View style={styles.serviceLabelContainer}>
                  <Text style={styles.serviceLabel}>{s.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons name="shirt-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>Rentals</Text>
            </View>
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => router.push("/rental")}
            >
              <Text style={styles.seeMoreText}>See All</Text>
              <Ionicons name="chevron-forward" size={18} color="#B45309" />
            </TouchableOpacity>
          </View>

          <View style={styles.rentalGrid}>
            {rentals.slice(0, 6).map((r) => (
              <TouchableOpacity
                key={r.item_id}
                style={styles.rentalCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/rental/${r.item_id}`)}
              >
                <View style={styles.imageWrapper}>
                  <Image
                    source={getImageSource(r)}
                    style={styles.rentalImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.8)"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
                <View style={styles.rentalInfoOverlay}>
                  <Text style={styles.rentalTitle} numberOfLines={2}>
                    {r.item_name}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.rentalPrice}>₱{r.daily_rate}</Text>
                    <Text style={styles.priceLabel}>/day</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* FIXED BOTTOM NAVIGATION — ALWAYS VISIBLE */}
      <View style={styles.bottomNav}>
        {/* Home - Active */}
        <View style={styles.navItemWrapActive}>
          <Ionicons name="home" size={24} color="#78350F" />
          <Text style={styles.navLabelActive}>Home</Text>
        </View>

        <TouchableOpacity
          onPress={() =>
            router.push("/(tabs)/appointment/appointmentSelection")
          }
          style={styles.navItemWrap}
        >
          <Ionicons name="calendar-outline" size={24} color="#64748B" />
          <Text style={styles.navLabel}>Book</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/faq")}
          style={styles.navItemWrap}
        >
          <Ionicons name="help-circle-outline" size={24} color="#64748B" />
          <Text style={styles.navLabel}>FAQ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/UserProfile/profile")}
          style={styles.navItemWrap}
        >
          <Ionicons name="person-outline" size={24} color="#64748B" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF9" },

  // Header
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

  // Hero
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
  heroBadge: { position: "absolute", bottom: 24, left: 24, right: 24 },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 10,
    marginBottom: 16,
  },
  heroButton: {
    backgroundColor: "#FDE68A",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    alignSelf: "flex-start",
  },
  heroButtonText: { color: "#78350F", fontWeight: "700", fontSize: 15 },

  // Sections
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
  seeMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  seeMoreText: { fontSize: 14, color: "#B45309", fontWeight: "700" },

  // Services Grid
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  serviceCard: {
    width: (width - 56) / 2,
    height: 180,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  serviceImageContainer: { flex: 1 },
  serviceImage: { width: "100%", height: "100%" },
  serviceGradient: { ...StyleSheet.absoluteFillObject },
  serviceLabelContainer: { position: "absolute", bottom: 16, left: 16 },
  serviceLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 8,
  },

  // Rentals Grid
  rentalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  rentalCard: {
    width: (width - 40 - 32) / 2,
    height: 200,
    marginHorizontal: 8,
    marginBottom: 16,
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
    textShadowRadius: 4,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  rentalPrice: { fontSize: 20, fontWeight: "900", color: "#F59E0B" },
  priceLabel: { fontSize: 12, color: "#CBD5E1", fontWeight: "600" },

  // FIXED BOTTOM NAV — ALWAYS ON TOP
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  navItemWrap: {
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  navItemWrapActive: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    gap: 4,
  },
  navLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  navLabelActive: {
    fontSize: 11,
    color: "#78350F",
    fontWeight: "700",
  },
  cartBadgeContainer: {
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
});
