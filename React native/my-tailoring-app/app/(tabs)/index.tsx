import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Poppins_300Light_Italic,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get("window");

export default function LandingScreen() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [fontsLoaded] = useFonts({
    Poppins_300Light_Italic,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {

          router.replace("/home");
        } else {
          setCheckingAuth(false);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  if (!fontsLoaded || checkingAuth) {
    return (
      <View style={[styles.background, { backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#A0522D" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/tailorbackground.jpg")}
      style={styles.background}
      resizeMode="cover"
      blurRadius={1.2}
    >
      <LinearGradient
        colors={[
          "rgba(15, 23, 42, 0.78)",
          "rgba(30, 41, 59, 0.68)",
          "rgba(51, 65, 85, 0.82)",
        ]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.brandName}>
            Welcome to Jackmans Tailor Deluxe!
          </Text>
        </View>
        <View style={styles.hero}>
          <Text style={styles.subtitle}>Your perfect fit awaits</Text>
        </View>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => router.replace("/login")}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={["#A0522D", "#8B4513", "#6B3A0A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.08,
  },

  header: {
    alignItems: "center",
    marginBottom: height * 0.07,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 70,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 5,
    borderColor: "rgba(251, 191, 36, 0.4)",
    marginBottom: 28,
    shadowColor: "#fbbf24",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 25,
  },
  logo: {
    width: 100,
    height: 100,
  },

  brandName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: "white",
    letterSpacing: 2,
    textAlign: "center",
    textShadowColor: "rgba(251, 191, 36, 0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  brandSubtitle: {
    fontFamily: "Poppins_300Light_Italic",
    fontSize: width * 0.068,
    color: "#e2e8f0",
    letterSpacing: 5,
    marginTop: 8,
    textAlign: "center",
    opacity: 0.95,
  },

  hero: {
    alignItems: "center",
    marginBottom: height * 0.08,
    paddingHorizontal: width * 0.1,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 18,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 30,
    paddingHorizontal: width * 0.06,
    opacity: 0.92,
    fontStyle: "italic",
  },

  buttonContainer: {
    marginBottom: height * 0.06,
    borderRadius: 70,
    overflow: "hidden",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 40,
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    paddingHorizontal: 50,
    gap: 16,
  },
  buttonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 19,
    color: "#FFFFFF",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  footerText: {
    fontFamily: "Poppins_300Light_Italic",
    fontSize: 14,
    color: "#94a3b8",
    letterSpacing: 2.5,
    textAlign: "center",
    opacity: 0.9,
  },
});
