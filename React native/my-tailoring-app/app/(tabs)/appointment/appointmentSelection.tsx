import * as React from "react";
import { useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import CustomizationModal from "./CustomizationModal";

const { width, height } = Dimensions.get("window");

export default function AppointmentSelection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);

  const services = [
    {
      id: "repair",
      label: "Repair Service",
      desc: "Expert restoration & stitching",
      gradient: ["#DBEAFE", "#BFDBFE"],
      shadowColor: "#3B82F6",
      icon: "cut-outline" as const,
    },
    {
      id: "custom",
      label: "Customize Service",
      desc: "Tailor-made designs just for you",
      gradient: ["#FEF3C7", "#FDE68A"],
      shadowColor: "#F59E0B",
      icon: "shirt-outline" as const,
    },
    {
      id: "drycleaning",
      label: "Dry Cleaning",
      desc: "Premium care & deep clean",
      gradient: ["#FCE7F3", "#FBCFE8"],
      shadowColor: "#EC4899",
      icon: "water-outline" as const,
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: height * 0.2 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require("../../../assets/images/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.headerTitle}>Jackman Tailor Deluxe</Text>
        </View>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Book an Appointment</Text>
          <Text style={styles.heroSubtitle}>
            Select your desired tailoring service
          </Text>
          <View style={styles.decorativeLine} />
        </View>
        <View style={styles.servicesContainer}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              activeOpacity={0.92}
              onPress={() => {
                if (service.id === "custom")
                  setShowCustomizationModal(true);
                else if (service.id === "repair")
                  router.push("../appointment/RepairClothes");
                else if (service.id === "drycleaning")
                  router.push("../appointment/DryCleaning");
              }}
            >
              <LinearGradient
                colors={service.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.serviceCard}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { shadowColor: service.shadowColor },
                  ]}
                >
                  <Ionicons
                    name={service.icon as any}
                    size={40}
                    color="#1e293b"
                  />
                </View>

                <View style={styles.textContainer}>
                  <Text style={styles.serviceTitle}>{service.label}</Text>
                  <Text style={styles.serviceDesc}>{service.desc}</Text>
                </View>

                <View style={styles.chevronCircle}>
                  <Ionicons name="chevron-forward" size={26} color="#64748b" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity onPress={() => router.replace("/home")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="home-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <View style={styles.navItemWrapActive}>
          <Ionicons name="cut" size={20} color="#7A5A00" />
        </View>

        <TouchableOpacity onPress={() => router.push("/(tabs)/faq")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("../UserProfile/profile")}
        >
          <View style={styles.navItemWrap}>
            <Ionicons name="person-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </View>
      <CustomizationModal
        visible={showCustomizationModal}
        onClose={() => setShowCustomizationModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fafafa" },
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: width * 0.06,
    paddingTop: height * 0.08,
    paddingBottom: 20,
  },
  logo: {
    width: width * 0.12,
    height: width * 0.12,
    borderRadius: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1e293b",
    marginLeft: 14,
    letterSpacing: 0.5,
  },

  heroCard: {
    marginHorizontal: width * 0.06,
    backgroundColor: "#ffffff",
    borderRadius: 32,
    paddingVertical: 40,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroTitle: {
    fontSize: width * 0.08,
    fontWeight: "900",
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 12,
    fontWeight: "500",
  },
  decorativeLine: {
    width: 80,
    height: 5,
    backgroundColor: "#F59E0B",
    borderRadius: 3,
    marginTop: 20,
  },

  servicesContainer: {
    paddingHorizontal: width * 0.06,
    marginTop: 32,
    gap: 20,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 18,
  },
  iconCircle: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  textContainer: {
    flex: 1,
    marginLeft: 20,
  },
  serviceTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.3,
  },
  serviceDesc: {
    fontSize: 14.5,
    color: "#475569",
    marginTop: 6,
    fontWeight: "600",
  },
  chevronCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
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
