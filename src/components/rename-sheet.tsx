import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type RenameSheetProps = {
  heading: string;
  /** Extra line under the heading, e.g. who can fill in a row. */
  note?: string;
  value: string;
  maxLength: number;
  onSave: (value: string) => void;
  onClose: () => void;
  /** Several lines of text, e.g. a page's instructions. */
  multiline?: boolean;
  /** Saving an empty value is allowed, e.g. to clear instructions. */
  allowEmpty?: boolean;
  /** Shows a remove button, e.g. "Remove from Vocalists". */
  removeLabel?: string;
  onRemove?: () => void;
};

/** A sheet that slides up to rename something, and optionally remove it. */
export function RenameSheet({
  heading,
  note,
  value,
  maxLength,
  onSave,
  onClose,
  multiline = false,
  allowEmpty = false,
  removeLabel,
  onRemove,
}: RenameSheetProps) {
  const [text, setText] = useState(value);
  const trimmed = text.trim();

  function save() {
    if (!trimmed && !allowEmpty) return;
    if (trimmed !== value) onSave(trimmed);
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{heading}</ThemedText>
        {note && (
          <ThemedText type="small" themeColor="textSecondary">
            {note}
          </ThemedText>
        )}
      </View>

      <TextField
        accessibilityLabel={heading}
        value={text}
        onChangeText={setText}
        autoFocus
        selectTextOnFocus={!multiline}
        maxLength={maxLength}
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'done'}
        onSubmitEditing={multiline ? undefined : save}
        style={multiline ? styles.multiline : undefined}
      />

      <View style={styles.actions}>
        <Button title="Save" onPress={save} disabled={!trimmed && !allowEmpty} />
        {onRemove && removeLabel && (
          <Button title={removeLabel} variant="secondary" onPress={onRemove} />
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
  actions: {
    gap: Spacing.two,
  },
  multiline: {
    minHeight: 120,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
});
