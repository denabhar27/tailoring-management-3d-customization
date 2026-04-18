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
import { validateRegistrationBirthdate } from '@/utils/ageValidation';

export default function SignupScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const sanitizePhilippinePhone = (value: string) => {
    let digitsOnly = String(value || "").replace(/\D/g, "");

    if (digitsOnly.startsWith("63")) {
      digitsOnly = digitsOnly.slice(2);
    }
    if (digitsOnly.startsWith("0")) {
      digitsOnly = digitsOnly.slice(1);
    }

    return digitsOnly.slice(0, 10);
  };

  const toLocalPhilippinePhone = (value: string) => {
    const normalized = sanitizePhilippinePhone(value);
    return normalized ? `0${normalized}` : "";
  };

  const validatePhoneNumber = (value: string) => {
    const normalizedPhone = sanitizePhilippinePhone(value);
    if (!/^9\d{9}$/.test(normalizedPhone)) {
      return {
        isValid: false,
        message: "Phone number must be a valid PH mobile number (e.g. +63 9XXXXXXXXX).",
      };
    }

    return { isValid: true, sanitizedPhone: normalizedPhone };
  };

  const validatePassword = (value: string) => {
    if (!value) {
      return { isValid: false, message: "Password is required" };
    }

    if (value.length < 8) {
      return {
        isValid: false,
        message: `Password must be at least 8 characters long. You have ${value.length} character(s).`,
      };
    }

    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/;
    if (!specialCharRegex.test(value)) {
      return {
        isValid: false,
        message: "Password must contain at least one special character (!@#$%^&* etc.)",
      };
    }

    return { isValid: true };
  };

  const handleSignup = async () => {
    const sanitizedPhone = sanitizePhilippinePhone(phoneNumber);

    if (!firstName || !lastName || !username || !email || !password || !confirmPassword || !sanitizedPhone || !birthdate) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const phoneValidation = validatePhoneNumber(sanitizedPhone);
    if (!phoneValidation.isValid) {
      Alert.alert("Error", phoneValidation.message);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      Alert.alert("Error", passwordValidation.message);
      return;
    }

    const birthdateCheck = validateRegistrationBirthdate(birthdate, 18);
    if (!birthdateCheck.ok) {
      Alert.alert("Error", birthdateCheck.message);
      return;
    }

    setLoading(true);
    try {
      const response = await authService.register({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        phone_number: toLocalPhilippinePhone(phoneValidation.sanitizedPhone),
        birthdate,
      });

      if (response.token) {

        await AsyncStorage.setItem('userToken', response.token);
        await AsyncStorage.setItem('userRole', response.role);
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.setItem('lastLoginUsername', username.trim());

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
                  placeholder="Middle Name (Optional)"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                  value={middleName}
                  onChangeText={setMiddleName}
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
              {!!password && (
                <View style={styles.helperBox}>
                  <Text style={styles.helperTitle}>Password Requirements:</Text>
                  <Text
                    style={[
                      styles.helperItem,
                      password.length >= 8
                        ? styles.helperSuccess
                        : password.length >= 6
                          ? styles.helperWarning
                          : styles.helperError,
                    ]}
                  >
                    {password.length >= 8 ? "✓" : password.length >= 6 ? "◐" : "✗"} Minimum 8 characters ({password.length}/8)
                  </Text>
                  <Text
                    style={[
                      styles.helperItem,
                      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(password)
                        ? styles.helperSuccess
                        : styles.helperError,
                    ]}
                  >
                    {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(password) ? "✓" : "✗"} At least one special character (!@#$%^&* etc.)
                  </Text>
                </View>
              )}
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
              {!!confirmPassword && (
                <Text
                  style={[
                    styles.inlineHelper,
                    password === confirmPassword ? styles.helperSuccess : styles.helperError,
                  ]}
                >
                  {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                </Text>
              )}
              <View style={styles.inputGroup}>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.phonePrefix}>+63</Text>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="9XXXXXXXXX"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={(text) => setPhoneNumber(sanitizePhilippinePhone(text))}
                    maxLength={10}
                  />
                </View>
              </View>
              {!!phoneNumber && !/^9\d{9}$/.test(sanitizePhilippinePhone(phoneNumber)) && (
                <Text style={[styles.inlineHelper, styles.helperError]}>
                  ✗ Use a valid PH mobile number (e.g. +63 9XXXXXXXXX).
                </Text>
              )}
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Birthdate (YYYY-MM-DD)"
                  placeholderTextColor="#999"
                  keyboardType="numbers-and-punctuation"
                  value={birthdate}
                  onChangeText={setBirthdate}
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
  helperBox: {
    width: "100%",
    marginTop: -4,
    marginBottom: 12,
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  helperTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#555",
    marginBottom: 4,
  },
  helperItem: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  helperSuccess: {
    color: "#28a745",
  },
  helperWarning: {
    color: "#fd7e14",
  },
  helperError: {
    color: "#dc3545",
  },
  inlineHelper: {
    width: "100%",
    marginTop: -6,
    marginBottom: 10,
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
  },
  phoneInputContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  phonePrefix: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#555",
    paddingLeft: 16,
    paddingRight: 6,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 18,
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "#333",
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
