
import * as React from "react";
import { useState, useEffect, useRef } from "react";
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
  RefreshControl,
  Alert,
} from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { rentalService } from "../../utils/rentalService";
import { notificationService, isAuthenticated } from "../../utils/apiService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { height, width } = Dimensions.get("window");
const SERVICE_PAGE_WIDTH = width - 40;

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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const servicePagerRef = useRef<ScrollView>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchRentals(), fetchUnreadCount()]);
    } finally {
      setRefreshing(false);
    }
  };

  const checkAuth = async () => {
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        // Token missing or expired — redirect handled by authEvents listener
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
    } catch (error: any) {
      // Silently ignore session-expired errors (redirect is handled globally)
      if (error?.message?.includes('Session expired')) return;
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#8B4513"]}
            tintColor="#8B4513"
            progressBackgroundColor="#FEF3C7"
          />
        }
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, zIndex: 1000 }}>
            <TouchableOpacity
              style={[styles.profileIcon, { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => {
                console.log('Cart icon pressed - navigating to cart');
                Alert.alert('Cart', 'Navigating to cart...');
                try {
                  router.push("/cart/Cart");
                } catch (error) {
                  console.error('Cart navigation error:', error);
                  Alert.alert('Error', String(error));
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="cart-outline" size={28} color="black" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileIcon, { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => {
                console.log('Notification icon pressed - navigating to notifications');
                Alert.alert('Notifications', 'Navigating to notifications...');
                try {
                  router.push("/notifications");
                } catch (error) {
                  console.error('Notification navigation error:', error);
                  Alert.alert('Error', String(error));
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="notifications-outline" size={28} color="black" />
              {unreadCount > 0 && (
                <View style={styles.badge} pointerEvents="none">
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
            colors={["rgba(0,0,0,0.18)", "rgba(120,53,15,0.72)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBadge}>
            <Text style={styles.heroTitle}>
              Sustainable Collection 2025
            </Text>
            <Text style={styles.heroSubtitle}>
              Timeless pieces crafted with care for the planet
            </Text>
            <View style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Explore Collection</Text>
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons name="cut" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>Our Services</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {services.map((s, idx) => {
              const active = activeServiceIndex === idx;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => {
                    setActiveServiceIndex(idx);
                    servicePagerRef.current?.scrollTo({ x: idx * SERVICE_PAGE_WIDTH, animated: true });
                  }}
                  style={[styles.tabItem, active && styles.tabItemActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            ref={servicePagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SERVICE_PAGE_WIDTH}
            snapToAlignment="start"
            onMomentumScrollEnd={(e) => {
              const next = Math.round(e.nativeEvent.contentOffset.x / SERVICE_PAGE_WIDTH);
              if (next !== activeServiceIndex) setActiveServiceIndex(next);
            }}
          >
            {services.map((s) => (
              <View key={s.id} style={{ width: SERVICE_PAGE_WIDTH }}>
                <TouchableOpacity
                  style={styles.serviceHeroCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (s.id === "s1") router.push("/rental");
                    else if (s.id === "s2")
                      router.push("/(tabs)/appointment/CustomizationService");
                    else if (s.id === "s3")
                      router.push("/(tabs)/appointment/RepairClothes");
                    else router.push("/(tabs)/appointment/DryCleaning");
                  }}
                >
                  <Image source={s.icon} style={styles.serviceHeroImage} resizeMode="cover" />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.1)", "rgba(15,23,42,0.95)"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.serviceHeroContent}>
                    <Text style={styles.serviceHeroTitle}>{s.label}</Text>
                    <View style={styles.serviceCTA}>
                      <Text style={styles.serviceCTAText}>Explore</Text>
                      <Ionicons name="arrow-forward" size={15} color="#1F2937" />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons name="pricetags" size={20} color="#F59E0B" />
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
                    <Text style={styles.rentalPrice}>₱{parseFloat(r.price || 0).toLocaleString()}</Text>
                    <Text style={styles.priceLabel}>/3 days</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* FIXED BOTTOM NAVIGATION — ALWAYS VISIBLE */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.navItemWrapActive}>
          <Ionicons name="home" size={20} color="#7A5A00" />
        </View>

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
    zIndex: 100,
  },
  greetingRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  logo: { width: 44, height: 44, borderRadius: 22 },
  brandInfo: { marginLeft: 12 },
  headerTitle: { fontWeight: "700", fontSize: 16, color: "#0F172A" },
  profileIcon: { 
    padding: 8, 
    position: "relative", 
    zIndex: 10,
    backgroundColor: 'transparent',
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

  // Hero
  heroContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    height: height * 0.22,
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
    top: 18,
    left: 18,
    right: 18,
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    lineHeight: 38,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 10,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    marginBottom: 10,
  },
  heroButton: {
    backgroundColor: "rgba(253,230,138,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    alignSelf: "center",
  },
  heroButtonText: { color: "#78350F", fontWeight: "700", fontSize: 11 },

  // Sections
  sectionContainer: { marginTop: 28, paddingHorizontal: 20 },
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
  tabBar: { paddingHorizontal: 6, gap: 8, marginBottom: 12 },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabItemActive: {
    backgroundColor: "#78350F",
    borderColor: "#78350F",
  },
  tabText: { color: "#78350F", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#FFFFFF" },
  serviceHeroCard: {
    height: 170,
    marginHorizontal: 0,
    marginBottom: 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  serviceHeroImage: { width: "100%", height: "100%", opacity: 0.92 },
  serviceHeroContent: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceHeroTitle: { color: "#fff", fontWeight: "800", fontSize: 20 },
  serviceCTA: {
    backgroundColor: "#FDE68A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 104,
    justifyContent: "center",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceCTAText: { color: "#1F2937", fontWeight: "800", fontSize: 13 },

  // Rentals Grid
  rentalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
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
