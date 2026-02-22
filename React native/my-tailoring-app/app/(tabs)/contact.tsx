import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ContactSupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleEmail = () => {
    Linking.openURL("mailto:support@jackmantailor.com?subject=Support Request");
  };

  const handlePhone = () => {
    Linking.openURL("tel:+630629912171");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Support</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Need More Help?</Text>
        <Text style={styles.sectionSubtitle}>
          Our support team is here to assist you with any questions or concerns.
        </Text>

        <TouchableOpacity style={styles.contactOption} onPress={handleEmail}>
          <View style={[styles.contactIconContainer, { backgroundColor: "#E3F2FD" }]}>
            <Ionicons name="mail-outline" size={28} color="#1976D2" />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactDetail}>support@jackmantailor.com</Text>
            <Text style={styles.contactNote}>Response within 24 hours</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactOption} onPress={handlePhone}>
          <View style={[styles.contactIconContainer, { backgroundColor: "#E8F5E9" }]}>
            <Ionicons name="call-outline" size={28} color="#388E3C" />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Phone Support</Text>
            <Text style={styles.contactDetail}>(062) 991 2171</Text>
            <Text style={styles.contactNote}>Mon-Sat, 8AM - 5PM</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>

        <View style={styles.businessHours}>
          <View style={styles.businessHoursHeader}>
            <Ionicons name="time-outline" size={24} color="#991b1b" />
            <Text style={styles.businessHoursTitle}>Business Hours</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.dayText}>Monday - Saturday</Text>
            <Text style={styles.timeText}>8:00 AM - 5:00 PM</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.dayText}>Sunday</Text>
            <Text style={styles.timeText}>Closed</Text>
          </View>
        </View>

        <View style={styles.storeLocation}>
          <View style={styles.businessHoursHeader}>
            <Ionicons name="location-outline" size={24} color="#991b1b" />
            <Text style={styles.businessHoursTitle}>Visit Our Store</Text>
          </View>
          <Text style={styles.addressText}>
            Jackman Tailor Deluxe{"\n"}
            41 Rizal Street, Zamboanga City{"\n"}
            7000 Zamboanga del Sur
          </Text>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => Linking.openURL("https://maps.google.com/?q=41+Rizal+Street+Zamboanga+City")}
          >
            <Ionicons name="navigate-outline" size={20} color="#fff" />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.faqLink}
          onPress={() => router.push("/(tabs)/faq")}
        >
          <View style={styles.faqLinkContent}>
            <Ionicons name="help-circle-outline" size={24} color="#991b1b" />
            <View style={styles.faqLinkText}>
              <Text style={styles.faqLinkTitle}>Browse FAQs</Text>
              <Text style={styles.faqLinkSubtitle}>Find answers to common questions</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#991b1b" />
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/home")}>
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
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    lineHeight: 20,
  },
  contactOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  contactDetail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  contactNote: {
    fontSize: 12,
    color: "#999",
  },
  businessHours: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  businessHoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  businessHoursTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayText: {
    fontSize: 14,
    color: "#666",
  },
  timeText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  storeLocation: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
    marginBottom: 16,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#991b1b",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  directionsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  faqLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#991b1b",
    borderStyle: "dashed",
  },
  faqLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  faqLinkText: {
    flex: 1,
  },
  faqLinkTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#991b1b",
  },
  faqLinkSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
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
