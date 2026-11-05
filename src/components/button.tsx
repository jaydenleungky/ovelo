import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** 'danger' looks like 'secondary' with red text, e.g. "Delete group". */
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const textColour = isPrimary ? theme.onTint : variant === 'danger' ? theme.danger : theme.text;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: isPrimary ? theme.tint : theme.backgroundElement },
        (pressed || inactive) && styles.dimmed,
      ]}>
      {/* Main buttons glow from the accent into a brighter coral. */}
      {isPrimary && (
        <LinearGradient
          colors={[theme.tint, theme.tintEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {loading ? (
        <ActivityIndicator color={textColour} />
      ) : (
        <ThemedText style={{ color: textColour, fontWeight: 600 }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    // Keeps the glow inside the rounded corners.
    overflow: 'hidden',
  },
  dimmed: {
    opacity: 0.6,
  },
});
