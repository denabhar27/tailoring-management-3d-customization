import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StatusBar } from "react-native";
import * as SystemUI from "expo-system-ui";

export default function TabLayout() {
  useEffect(() => {
    const configureEdgeToEdge = async () => {
      try {
        await SystemUI.setBackgroundColorAsync('transparent');
        if (Platform.OS === 'android') {
          try {
            const NavigationBar: any = require('expo-navigation-bar');
            if (NavigationBar?.setBehaviorAsync) {
              await NavigationBar.setBehaviorAsync('overlay-swipe');
            }
            if (NavigationBar?.setBackgroundColorAsync) {
              await NavigationBar.setBackgroundColorAsync('transparent');
            }
            if (NavigationBar?.setButtonStyleAsync) {
              await NavigationBar.setButtonStyleAsync('light');
            }
          } catch {
            // NavigationBar module not installed; proceed without it
          }
        }
      } catch (e) {
        // no-op fallback if API not available
      }
    };
    configureEdgeToEdge();
  }, []);

  return (
    <>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
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
    </>
  );
}