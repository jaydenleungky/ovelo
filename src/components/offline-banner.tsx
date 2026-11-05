import { useNetworkState } from 'expo-network';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A small notice at the bottom of the screen while there's no internet.
 * Live updates catch up by themselves once the connection is back.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetworkState();
  // Both start unknown; only show the banner once we know it's offline.
  const offline = isConnected === false || isInternetReachable === false;
  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: Spacing.three + insets.bottom }]}
      accessibilityLiveRegion="polite">
      <View
        accessibilityRole="alert"
        style={[styles.banner, { backgroundColor: theme.text }]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          You’re offline
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.background }}>
          Changes won’t save until you’re back online.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  banner: {
    maxWidth: 480,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
});
