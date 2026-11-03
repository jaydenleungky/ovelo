import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows a × and calls this when tapped, for removable chips. */
  onRemove?: () => void;
};

/** A small rounded toggle, e.g. a weekday or a section name. */
export function Chip({ label, selected = false, onPress, onRemove }: ChipProps) {
  const theme = useTheme();
  const removable = !!onRemove;

  return (
    <Pressable
      accessibilityRole={removable ? 'button' : 'checkbox'}
      accessibilityState={removable ? undefined : { checked: selected }}
      accessibilityLabel={removable ? `Remove ${label}` : label}
      onPress={onRemove ?? onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: theme.tint, borderColor: theme.tint }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onTint : theme.text }}>
        {label}
        {removable ? '  ×' : ''}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
