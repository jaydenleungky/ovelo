import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';

type ChipListEditorProps = {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  placeholder: string;
};

/** Removable chips plus a field to add more, e.g. section names or column labels. */
export function ChipListEditor({ items, onChange, addLabel, placeholder }: ChipListEditorProps) {
  const [draft, setDraft] = useState('');

  function add() {
    const value = draft.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft('');
  }

  return (
    <View style={styles.container}>
      {items.length > 0 && (
        <View style={styles.chips}>
          {items.map((item) => (
            <Chip key={item} label={item} onRemove={() => onChange(items.filter((x) => x !== item))} />
          ))}
        </View>
      )}
      <View style={styles.addRow}>
        <View style={styles.input}>
          <TextField
            accessibilityLabel={addLabel}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            returnKeyType="done"
            onSubmitEditing={add}
            maxLength={30}
          />
        </View>
        <Button title="Add" variant="secondary" onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
  },
});
