

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from "react-native";
import {
  InlineHelp,
  FormFieldHelp,
  TooltipHelp,
  ValidationHelp,
} from "../components/InlineHelp";

export const RegistrationFormExample = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registration Form</Text>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <InlineHelp
          text="We'll use this to send order confirmations, tracking updates, and important notifications about your orders."
          type="info"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Create a password"
          secureTextEntry
        />
        <InlineHelp
          text="Password must be at least 8 characters with uppercase, lowercase, and numbers for your account security."
          type="warning"
        />
      </View>
    </View>
  );
};

export const ValidationFeedbackExample = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Validation Feedback</Text>
      <InlineHelp
        text="Please enter a valid email address."
        type="error"
        dismissible={false}
      />
      <InlineHelp
        text="Your session will expire in 5 minutes. Please save your work."
        type="warning"
      />
      <InlineHelp
        text="Your profile has been updated successfully!"
        type="success"
      />
      <InlineHelp
        text="Tip: You can drag and drop images to upload them."
        type="info"
      />
    </View>
  );
};

export const FormFieldHelpExample = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Form Field Hints</Text>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+63 XXX XXX XXXX"
          keyboardType="phone-pad"
        />
        <FormFieldHelp
          text="Include country code for international numbers"
          alwaysVisible
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Delivery Address</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Enter your full address"
          multiline
        />
        <FormFieldHelp
          text="Please include building name, floor number, and any landmarks for easier delivery. Our riders will call you if they have trouble finding your location."
        />
      </View>
    </View>
  );
};

export const TooltipHelpExample = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Label Tooltips</Text>

      <View style={styles.fieldContainer}>
        <TooltipHelp
          label="Fabric Type"
          helpText="Choose from cotton, silk, polyester, or blend. The fabric type affects pricing, care instructions, and lead time."
        />
        <TextInput
          style={styles.input}
          placeholder="Select fabric type"
        />
      </View>

      <View style={styles.fieldContainer}>
        <TooltipHelp
          label="Rush Order"
          helpText="Rush orders are completed within 24-48 hours but incur an additional 50% fee. Not available for all services."
        />
        <TextInput
          style={styles.input}
          placeholder="Select delivery option"
        />
      </View>
    </View>
  );
};

export const PasswordValidationExample = () => {
  const [password, setPassword] = useState("");

  const requirements = [
    { label: "At least 8 characters", isMet: password.length >= 8 },
    { label: "Contains uppercase letter", isMet: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", isMet: /[a-z]/.test(password) },
    { label: "Contains a number", isMet: /\d/.test(password) },
    { label: "Contains special character", isMet: /[!@#$%^&*]/.test(password) },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Password Requirements</Text>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Create Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
        />
        <ValidationHelp requirements={requirements} />
      </View>
    </View>
  );
};

export const CompleteFormExample = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    specialInstructions: "",
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Complete Order Form</Text>
      <InlineHelp
        text="Fields marked with * are required. Please fill in all details accurately to ensure smooth delivery."
        type="info"
        dismissible={false}
      />
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="Enter your full name"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="Enter your email"
          keyboardType="email-address"
        />
        <FormFieldHelp
          text="We'll send order confirmation and tracking updates to this email"
          alwaysVisible
        />
      </View>
      <View style={styles.fieldContainer}>
        <TooltipHelp
          label="Phone Number *"
          helpText="Our delivery rider will contact you on this number. Please ensure it's reachable during delivery hours."
        />
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="+63 XXX XXX XXXX"
          keyboardType="phone-pad"
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Delivery Address *</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={formData.address}
          onChangeText={(text) => setFormData({ ...formData, address: text })}
          placeholder="Enter your full address"
          multiline
        />
        <FormFieldHelp
          text="Include building name, floor number, unit number, and nearby landmarks. Complete addresses help our riders deliver faster."
        />
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Special Instructions (Optional)</Text>
        <TextInput
          style={[styles.input, { height: 60 }]}
          value={formData.specialInstructions}
          onChangeText={(text) =>
            setFormData({ ...formData, specialInstructions: text })
          }
          placeholder="Any special requests?"
          multiline
        />
        <InlineHelp
          text="Let us know about specific fabric preferences, fitting concerns, or delivery time preferences."
          type="info"
        />
      </View>
      <InlineHelp
        text="Orders placed after 4 PM will be processed the next business day."
        type="warning"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
});

export default {
  RegistrationFormExample,
  ValidationFeedbackExample,
  FormFieldHelpExample,
  TooltipHelpExample,
  PasswordValidationExample,
  CompleteFormExample,
};
