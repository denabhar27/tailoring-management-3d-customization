import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';
import 'react-native-reanimated';

declare const ErrorUtils: {
  getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | null;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

export default function RootLayout() {
  useEffect(() => {

    SystemUI.setBackgroundColorAsync('#ffffff');

    const originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {

      if (error?.message?.includes('Failed to download remote update') ||
          error?.message?.includes('java.io.IOException') ||
          error?.message?.includes('remote update')) {
        console.warn('Update check failed (ignored):', error.message);
        return;
      }

      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });

    const originalUnhandledRejection = global.onunhandledrejection;
    global.onunhandledrejection = (event: any) => {
      const error = event?.reason || event;
      if (error?.message?.includes('Failed to download remote update') ||
          error?.message?.includes('java.io.IOException') ||
          error?.message?.includes('remote update')) {
        console.warn('Update check promise rejection (ignored):', error?.message);
        event?.preventDefault?.();
        return;
      }

      if (originalUnhandledRejection) {
        originalUnhandledRejection(event);
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" translucent={false} />
    </SafeAreaProvider>
  );
}
