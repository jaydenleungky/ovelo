import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Option } from '@/lib/pages';
import { ON_CHOICE_COLOUR, type CellType } from '@/lib/templates';

export type CellTarget = {
  rowId: string;
  columnId: string;
  rowLabel: string;
  columnLabel: string;
  cellType: CellType;
  value: string;
};

type CellEditorProps = {
  target: CellTarget;
  options: Option[];
  onSave: (value: string) => void;
  onClose: () => void;
};

const MAX_TEXT_LENGTH = 60;

/**
 * A sheet that slides up to edit one cell: pick a choice, or type text.
 * Render it with a `key` per cell so the text field starts fresh each time.
 */
export function CellEditor({ target, options, onSave, onClose }: CellEditorProps) {
  const theme = useTheme();
  const [text, setText] = useState(target.value);

  function save(value: string) {
    onSave(value);
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{target.rowLabel}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {target.columnLabel}
        </ThemedText>
      </View>

      {target.cellType === 'option' ? (
        <View style={styles.options}>
          {options.map((option) => {
            const selected = option.value === target.value;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.value}, ${option.label}`}
                onPress={() => save(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: option.colour,
                    // A ring in the text colour marks the current value.
                    borderColor: selected ? theme.text : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="subtitle" style={{ color: ON_CHOICE_COLOUR }}>
                  {option.value}
                </ThemedText>
                <ThemedText type="small" style={{ color: ON_CHOICE_COLOUR }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextField
          accessibilityLabel={`${target.rowLabel}, ${target.columnLabel}`}
          value={text}
          onChangeText={setText}
          placeholder="e.g. 2–5pm"
          autoFocus
          maxLength={MAX_TEXT_LENGTH}
          returnKeyType="done"
          onSubmitEditing={() => save(text.trim())}
        />
      )}

      <View style={styles.actions}>
        {target.cellType === 'text' && (
          <Button title="Save" onPress={() => save(text.trim())} />
        )}
        {target.value !== '' && (
          <Button title="Clear" variant="secondary" onPress={() => save('')} />
        )}
        <Button title="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.half,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    flexGrow: 1,
    flexBasis: 96,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  actions: {
    gap: Spacing.two,
  },
});
