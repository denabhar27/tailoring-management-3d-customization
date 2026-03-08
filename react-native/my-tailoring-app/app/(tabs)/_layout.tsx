import { Stack } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="home" />
      <Stack.Screen name="explore" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="faq" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="appointment" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="rental" />
      <Stack.Screen name="UserProfile" />
    </Stack>
  );
}