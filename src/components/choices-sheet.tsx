import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LegendEditor } from '@/components/page-builder/legend-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Option, OptionEdit } from '@/lib/pages';

type ChoicesSheetProps = {
  options: Option[];
  /** The page has choice sections, so it needs at least one choice. */
  required: boolean;
  onSave: (next: OptionEdit[]) => void;
  onClose: () => void;
};

/** Edit the choices people pick in a page's cells. Nothing changes until Save. */
export function ChoicesSheet({ options, required, onSave, onClose }: ChoicesSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [next, setNext] = useState<OptionEdit[]>(options);
  const [error, setError] = useState<string | null>(null);

  // Picking a preset replaces every choice; keep the ids of any whose code
  // stays the same so their cells are kept rather than cleared.
  function handleChange(changed: OptionEdit[]) {
    const used = new Set(changed.flatMap((o) => (o.id ? [o.id] : [])));
    setNext(
      changed.map((o) => {
        if (o.id) return o;
        const match = options.find((old) => old.value === o.value && !used.has(old.id));
        if (!match) return o;
        used.add(match.id);
        return { ...o, id: match.id };
      }),
    );
    setError(null);
  }

  function save() {
    const cleaned = next.map((o) => ({ ...o, value: o.value.trim(), label: o.label.trim() }));
    if (required && cleaned.length === 0) {
      return setError('This page has choice sections, so it needs at least one choice.');
    }
    if (cleaned.some((o) => !o.value)) return setError('Every choice needs a short code, e.g. Y.');
    const codes = cleaned.map((o) => o.value.toUpperCase());
    if (new Set(codes).size !== codes.length) return setError('Each choice needs a different code.');
    if (cleaned.some((o) => o.value.startsWith('~'))) return setError('Codes can’t start with ~.');
    onSave(cleaned);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <ThemedView
          style={[
            styles.sheet,
            { paddingBottom: Spacing.four + insets.bottom, borderColor: theme.border },
          ]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <LegendEditor options={next} onChange={handleChange} />
            <ThemedText type="small" themeColor="textSecondary">
              Changing a code updates every cell that uses it. Removing a choice clears the cells
              that use it.
            </ThemedText>

            {error && (
              <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
                {error}
              </ThemedText>
            )}

            <View style={styles.actions}>
              <Button title="Save" onPress={save} />
              <Button title="Cancel" variant="secondary" onPress={onClose} />
            </View>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Dim the whole screen, including beside a narrow sheet on wide screens.
  fill: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    maxHeight: '85%',
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  actions: {
    gap: Spacing.two,
  },
});
