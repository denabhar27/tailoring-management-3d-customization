import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
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
import { authService } from "@/utils/apiService";

type Step = "forgot" | "verify" | "reset" | "success";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  // Current step
  const [step, setStep] = useState<Step>("forgot");
  
  // Form data
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Resend cooldown timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Validate password
  const validatePassword = (password: string) => {
    if (!password) {
      return { isValid: false, message: "Password is required" };
    }
    if (password.length < 8) {
      return { isValid: false, message: `Password must be at least 8 characters long.` };
    }
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
    if (!specialCharRegex.test(password)) {
      return { isValid: false, message: "Password must contain at least one special character" };
    }
    return { isValid: true, message: "" };
  };

  // Step 1: Request security code
  const handleForgotPassword = async () => {
    if (!usernameOrEmail.trim()) {
      Alert.alert("Error", "Please enter your username or email");
      return;
    }

    setLoading(true);
    try {
      const result = await authService.forgotPassword(usernameOrEmail.trim());
      
      if (result.success) {
        Alert.alert("Success", "Security code sent! Check your email.");
        setStep("verify");
        setResendCooldown(60);
      } else {
        Alert.alert("Error", result.message || "Failed to send security code");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify security code
  const handleVerifyCode = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Please enter the security code");
      return;
    }

    if (code.trim().length !== 6) {
      Alert.alert("Error", "Please enter the complete 6-character code");
      return;
    }

    setLoading(true);
    try {
      const result = await authService.verifyResetCode(code.trim(), usernameOrEmail);
      
      if (result.success && result.resetToken) {
        setResetToken(result.resetToken);
        Alert.alert("Success", "Code verified! Enter your new password.");
        setStep("reset");
      } else {
        Alert.alert("Error", result.message || "Invalid code");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please enter and confirm your new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      Alert.alert("Error", validation.message);
      return;
    }

    setLoading(true);
    try {
      const result = await authService.resetPassword(resetToken, newPassword, confirmPassword);
      
      if (result.success) {
        setStep("success");
      } else {
        Alert.alert("Error", result.message || "Failed to reset password");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    try {
      const result = await authService.resendResetCode(usernameOrEmail);
      
      if (result.success) {
        Alert.alert("Success", "New security code sent!");
        setResendCooldown(60);
      } else {
        Alert.alert("Error", result.message || "Failed to resend code");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle code input (auto-format)
  const handleCodeChange = (text: string) => {
    const value = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (value.length <= 6) {
      setCode(value);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  // Render step indicator
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.step, step !== "forgot" ? styles.stepCompleted : styles.stepActive]}>
        <Text style={styles.stepText}>{step !== "forgot" ? "✓" : "1"}</Text>
      </View>
      <View style={[styles.stepLine, step !== "forgot" && styles.stepLineCompleted]} />
      <View style={[
        styles.step, 
        step === "verify" && styles.stepActive,
        (step === "reset" || step === "success") && styles.stepCompleted
      ]}>
        <Text style={styles.stepText}>{(step === "reset" || step === "success") ? "✓" : "2"}</Text>
      </View>
      <View style={[styles.stepLine, (step === "reset" || step === "success") && styles.stepLineCompleted]} />
      <View style={[
        styles.step,
        step === "reset" && styles.stepActive,
        step === "success" && styles.stepCompleted
      ]}>
        <Text style={styles.stepText}>{step === "success" ? "✓" : "3"}</Text>
      </View>
    </View>
  );

  // Render content based on step
  const renderContent = () => {
    switch (step) {
      case "forgot":
        return (
          <>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your username or email to receive a security code.
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Username or Email"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                value={usernameOrEmail}
                onChangeText={setUsernameOrEmail}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Send Security Code</Text>
              )}
            </TouchableOpacity>
          </>
        );

      case "verify":
        return (
          <>
            <Text style={styles.title}>Enter Security Code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-character code to your email.
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                value={code}
                onChangeText={handleCodeChange}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendSection}>
              <Text style={styles.resendText}>Didn&apos;t receive the code?</Text>
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={resendCooldown > 0 || loading}
              >
                <Text style={[
                  styles.resendLink,
                  (resendCooldown > 0 || loading) && styles.resendLinkDisabled
                ]}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => { setStep("forgot"); setCode(""); }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </>
        );

      case "reset":
        return (
          <>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Create a new password for your account.
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!loading}
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

            <Text style={styles.passwordHint}>
              Must be 8+ characters with at least one special character
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => { setStep("verify"); setNewPassword(""); setConfirmPassword(""); }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </>
        );

      case "success":
        return (
          <>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={styles.title}>Password Reset Successful!</Text>
            <Text style={styles.subtitle}>
              Your password has been updated. You can now log in with your new password.
            </Text>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.submitButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.card}>
              {step !== "success" && renderStepIndicator()}
              {renderContent()}
            </View>

            {step === "forgot" && (
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => router.back()}
              >
                <Text style={styles.loginLinkText}>
                  Remember your password? <Text style={styles.loginLinkBold}>Login</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  container: {
    padding: 24,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: {
    backgroundColor: "#667eea",
  },
  stepCompleted: {
    backgroundColor: "#4caf50",
  },
  stepText: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: "#4caf50",
  },
  title: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: "#222",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    width: "100%",
    marginBottom: 16,
    position: "relative",
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
    backgroundColor: "#fafafa",
    color: "#222",
  },
  codeInput: {
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: "Poppins_600SemiBold",
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 14,
  },
  passwordHint: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "#888",
    marginBottom: 16,
    marginTop: -8,
  },
  submitButton: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    backgroundColor: "#667eea",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
  resendSection: {
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  resendText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#888",
  },
  resendLink: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#667eea",
    marginTop: 4,
  },
  resendLinkDisabled: {
    color: "#aaa",
  },
  backButton: {
    alignItems: "center",
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: "#667eea",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4caf50",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  loginLink: {
    marginTop: 24,
  },
  loginLinkText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "#666",
  },
  loginLinkBold: {
    fontFamily: "Poppins_600SemiBold",
    color: "#667eea",
  },
});
