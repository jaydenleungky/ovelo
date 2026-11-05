import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(value);
  const trimmed = text.trim();

  function save() {
    if (!trimmed && !allowEmpty) return;
    if (trimmed !== value) onSave(trimmed);
    onClose();
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
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
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
