import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LegendEditor } from '@/components/page-builder/legend-editor';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
    <Sheet onClose={onClose} scroll>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: Spacing.two,
  },
});
