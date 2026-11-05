import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CellType } from '@/lib/templates';

type AddSectionSheetProps = {
  /** Titles already on the page, so a new one doesn't repeat them. */
  existingTitles: string[];
  /** Choice sections need the page to have choices (e.g. Y / N). */
  hasChoices: boolean;
  onAdd: (title: string, cellType: CellType) => void;
  onClose: () => void;
};

const MAX_TITLE_LENGTH = 40;

/** A sheet to add a section to the end of a page. */
export function AddSectionSheet({ existingTitles, hasChoices, onAdd, onClose }: AddSectionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [cellType, setCellType] = useState<CellType>(hasChoices ? 'option' : 'text');
  const [error, setError] = useState<string | null>(null);

  function add() {
    const trimmed = title.trim();
    if (!trimmed) return setError('Give the section a name.');
    if (existingTitles.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      return setError('There’s already a section with that name.');
    }
    onAdd(trimmed, cellType);
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
          <TextField
            label="New section"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError(null);
            }}
            placeholder="e.g. Helpers"
            autoFocus
            maxLength={MAX_TITLE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={add}
          />

          {hasChoices ? (
            <View style={styles.group}>
              <SegmentedControl<CellType>
                segments={[
                  { value: 'option', label: 'Choice' },
                  { value: 'text', label: 'Text' },
                ]}
                value={cellType}
                onChange={setCellType}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {cellType === 'option'
                  ? 'People pick one of this page’s choices in each cell.'
                  : 'People type anything in a cell, e.g. “2–5pm”.'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              People type anything in a cell, e.g. “2–5pm”.
            </ThemedText>
          )}

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              {error}
            </ThemedText>
          )}

          <View style={styles.actions}>
            <Button title="Add section" onPress={add} disabled={!title.trim()} />
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
  group: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
});
