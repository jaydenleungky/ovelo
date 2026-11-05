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

/** A row that's just a name: someone not on Ovelo, or a fixed row like "Car". */
export type NamedRow = { id: string; label: string };

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
  /** Rows that are just a name. */
  namedRows: NamedRow[];
  /** Admins only: add a row with this name. */
  onAddName?: (name: string) => void;
  /** Admins only: remove a named row. */
  onRemoveNamed?: (rowId: string) => void;
};

const MAX_TITLE_LENGTH = 40;
const MAX_NAME_LENGTH = 40;

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
  namedRows,
  onAddName,
  onRemoveNamed,
}: SectionSheetProps) {
  const theme = useTheme();
  const [text, setText] = useState(title);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  function addName() {
    const name = newName.trim();
    if (!name || !onAddName) return;
    const taken = [
      ...namedRows.map((r) => r.label),
      ...people.filter((p) => p.inSection).map((p) => p.name),
    ];
    if (taken.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setNameError(`${name} is already in this section.`);
      return;
    }
    onAddName(name);
    setNewName('');
    setNameError(null);
  }

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

      {(onAddName || namedRows.length > 0) && (
        <View style={styles.people}>
          <ThemedText type="smallBold">{holdsPeople ? 'Not on Ovelo' : 'Rows'}</ThemedText>
          {onAddName && (
            <ThemedText type="small" themeColor="textSecondary">
              {holdsPeople
                ? 'Add someone who doesn’t use the app. You can fill in their row for them.'
                : 'Add another row, e.g. for a second car.'}
            </ThemedText>
          )}
          {namedRows.map((row) => (
            <View
              key={row.id}
              style={[styles.person, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" style={styles.personName}>
                {row.label}
              </ThemedText>
              {onRemoveNamed && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${row.label}`}
                  hitSlop={8}
                  onPress={() => onRemoveNamed(row.id)}>
                  <ThemedText themeColor="textSecondary" style={styles.remove}>
                    ×
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ))}
          {onAddName && (
            <View style={styles.addRow}>
              <View style={styles.addInput}>
                <TextField
                  accessibilityLabel={
                    holdsPeople ? 'Name of someone not on Ovelo' : 'Name of a new row'
                  }
                  value={newName}
                  onChangeText={(value) => {
                    setNewName(value);
                    setNameError(null);
                  }}
                  placeholder={holdsPeople ? 'e.g. Grandma' : 'e.g. Van'}
                  maxLength={MAX_NAME_LENGTH}
                  returnKeyType="done"
                  onSubmitEditing={addName}
                />
              </View>
              <Button
                title="Add"
                variant="secondary"
                onPress={addName}
                disabled={!newName.trim()}
              />
            </View>
          )}
          {nameError && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              {nameError}
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
  remove: {
    fontSize: 22,
    paddingHorizontal: Spacing.one,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  addInput: {
    flex: 1,
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
