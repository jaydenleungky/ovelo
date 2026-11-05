import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OfflineBanner } from '@/components/offline-banner';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

// Navigation headers and screen backgrounds in Ovelo's colours.
function navigationTheme(base: typeof DefaultTheme, colors: (typeof Colors)['light' | 'dark']) {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.tint,
    },
  };
}

const LIGHT_NAVIGATION = navigationTheme(DefaultTheme, Colors.light);
const DARK_NAVIGATION = navigationTheme(DarkTheme, Colors.dark);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    // Gestures such as dragging names to reorder them need this at the root.
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DARK_NAVIGATION : LIGHT_NAVIGATION}>
        <AuthProvider>
          <RootNavigator />
          <OfflineBanner />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, isLoading, isResettingPassword } = useAuth();

  // Keep the splash screen up until we know whether the user is signed in.
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !isResettingPassword}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      {/* Stays open while a reset code has signed you in but the new password isn't saved yet. */}
      <Stack.Protected guard={!session || isResettingPassword}>
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
