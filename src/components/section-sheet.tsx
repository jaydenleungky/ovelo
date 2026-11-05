import { useState } from 'react';
import {
  ActivityIndicator,
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
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SectionPerson = {
  userId: string;
  name: string;
  inSection: boolean;
  /** You can tick yourself; admins can tick anyone. */
  canToggle: boolean;
  /** A change for this person is still saving. */
  busy: boolean;
};

type SectionSheetProps = {
  title: string;
  canRename: boolean;
  /** False for sections with fixed rows, like the shared "Car" row. */
  holdsPeople: boolean;
  people: SectionPerson[];
  onToggle: (userId: string, inSection: boolean) => void;
  onRename: (title: string) => void;
  onClose: () => void;
  /** Admins only. Missing when it's the page's only section. */
  onDelete?: () => void;
};

const MAX_TITLE_LENGTH = 40;

/** Tap a section's title: choose who's in it, and (admins) rename it. */
export function SectionSheet({
  title,
  canRename,
  holdsPeople,
  people,
  onToggle,
  onRename,
  onClose,
  onDelete,
}: SectionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(title);

  // Ticks save as you tap them; Done saves the name too.
  function done() {
    const trimmed = text.trim();
    if (canRename && trimmed && trimmed !== title) onRename(trimmed);
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={done}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.backdrop}
          onPress={done}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <ThemedView
          style={[
            styles.sheet,
            { paddingBottom: Spacing.four + insets.bottom, borderColor: theme.border },
          ]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {canRename ? (
              <TextField
                label="Section name"
                value={text}
                onChangeText={setText}
                maxLength={MAX_TITLE_LENGTH}
                returnKeyType="done"
                onSubmitEditing={done}
              />
            ) : (
              <ThemedText type="smallBold">{title}</ThemedText>
            )}

            {holdsPeople && (
              <View style={styles.people}>
                <ThemedText type="smallBold">Who’s in {canRename ? 'this section' : title}</ThemedText>
                {people.map((person) => (
                  <Pressable
                    key={person.userId}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: person.inSection,
                      disabled: !person.canToggle || person.busy,
                    }}
                    accessibilityLabel={person.name}
                    disabled={!person.canToggle || person.busy}
                    onPress={() => onToggle(person.userId, !person.inSection)}
                    style={({ pressed }) => [
                      styles.person,
                      { backgroundColor: theme.backgroundElement },
                      !person.canToggle && styles.readOnly,
                      pressed && styles.pressed,
                    ]}>
                    <View
                      style={[
                        styles.box,
                        { borderColor: person.inSection ? theme.tint : theme.border },
                        person.inSection && { backgroundColor: theme.tint },
                      ]}>
                      {person.inSection && (
                        <ThemedText type="smallBold" style={{ color: theme.onTint }}>
                          ✓
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText type="small" style={styles.personName}>
                      {person.name}
                    </ThemedText>
                    {person.busy && <ActivityIndicator size="small" />}
                  </Pressable>
                ))}
                {!canRename && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Tick yourself to add your row. Admins can add anyone.
                  </ThemedText>
                )}
              </View>
            )}

            <Button title="Done" onPress={done} />
            {onDelete && (
              <Pressable
                accessibilityRole="button"
                onPress={onDelete}
                style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
                <ThemedText type="small" style={{ color: theme.danger, fontWeight: 600 }}>
                  Delete section
                </ThemedText>
              </Pressable>
            )}
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
    maxHeight: '80%',
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
  people: {
    gap: Spacing.two,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  personName: {
    flex: 1,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  readOnly: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
