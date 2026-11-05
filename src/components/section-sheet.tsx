import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
  const [text, setText] = useState(title);

  // Ticks save as you tap them; Done saves the name too.
  function done() {
    const trimmed = text.trim();
    if (canRename && trimmed && trimmed !== title) onRename(trimmed);
    onClose();
  }

  return (
    <Sheet onClose={done} scroll>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
