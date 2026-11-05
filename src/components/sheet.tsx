import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWideScreen } from '@/hooks/use-wide-screen';

type SheetProps = {
  onClose: () => void;
  children: ReactNode;
  /** Let long contents scroll inside the sheet. */
  scroll?: boolean;
};

const DIALOG_WIDTH = 520;

/**
 * A pop-up for editing something. On phones it slides up from the bottom;
 * on wide screens it's a centred box, which feels more natural with a mouse.
 * Tapping the dimmed background closes it.
 */
export function Sheet({ onClose, children, scroll = false }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWideScreen();

  const content = [styles.content, !wide && { paddingBottom: Spacing.four + insets.bottom }];

  return (
    <Modal
      visible
      transparent
      animationType={wide ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.fill, wide && styles.fillWide]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <ThemedView
          style={[
            styles.sheet,
            wide ? styles.dialog : styles.bottom,
            { borderColor: theme.border },
          ]}>
          {scroll ? (
            <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={content}>{children}</View>
          )}
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The dimmed colour covers the whole screen, including beside the sheet.
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  fillWide: {
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  bottom: {
    maxWidth: 800,
    maxHeight: '85%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderBottomWidth: 0,
  },
  dialog: {
    maxWidth: DIALOG_WIDTH,
    maxHeight: '85%',
    borderRadius: Spacing.four,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
