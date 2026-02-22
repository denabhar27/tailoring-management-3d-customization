import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/utils/apiService';

export default function SignupScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const handleSignup = async () => {

    if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.register({
        first_name: firstName,
        last_name: lastName,
        username: username,
        email: email,
        password: password,
        phone_number: phoneNumber
      });

      if (response.token) {

        await AsyncStorage.setItem('userToken', response.token);
        await AsyncStorage.setItem('userRole', response.role);
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));

        router.replace("/home");
      } else {
        Alert.alert("Signup Failed", response.message || "Failed to create account");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      Alert.alert("Error", error.message || "Failed to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.card}>
              <View style={styles.header}>
                <Image
                  source={require("../../assets/images/logo copy.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.title}>Create Your Account</Text>
                <Text style={styles.subtitle}>
                  Join the Jackman Tailor Deluxe family
                </Text>
              </View>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => router.push("/login")}
                >
                  <Text style={styles.toggleButtonText}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, styles.toggleButtonActive]}
                  onPress={() => {}}
                >
                  <Text style={styles.toggleButtonTextActive}>Sign Up</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="First Name"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Last Name"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#888"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#888"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number (Optional)"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              </View>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSignup}
                activeOpacity={0.9}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? "Processing..." : "Create Account"}
                </Text>
              </TouchableOpacity>
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Already have an account?{" "}
                  <Text style={styles.footerLink} onPress={() => router.push("/login")}>
                    Login Here
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#f8f4f0",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#8B4513",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 50,
    elevation: 15,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 28,
    color: "#8B4513",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#eee",
    borderRadius: 50,
    padding: 6,
    marginBottom: 24,
    alignSelf: "center",
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 50,
    backgroundColor: "transparent",
  },
  toggleButtonActive: {
    backgroundColor: "#8B4513",
    shadowColor: "#8B4513",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 4,
  },
  toggleButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#888",
  },
  toggleButtonTextActive: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 14,
    position: "relative",
  },
  input: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    backgroundColor: "#ffffff",
    color: "#333",
  },
  eyeIcon: {
    position: "absolute",
    right: 18,
    top: 14,
  },
  submitButton: {
    width: "100%",
    paddingVertical: 14,
    backgroundColor: "#8B4513",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#8B4513",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  submitButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#ffffff",
  },
  footer: {
    marginTop: 24,
  },
  footerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },
  footerLink: {
    fontFamily: "Poppins_700Bold",
    color: "#8B4513",
    textDecorationLine: "underline",
  },
});
