import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CellType, SectionSpec } from '@/lib/templates';

type SectionListEditorProps = {
  sections: SectionSpec[];
  onChange: (sections: SectionSpec[]) => void;
};

export const NEW_SECTION: SectionSpec = {
  title: '',
  cellType: 'option',
  notify: false,
  rows: 'members',
};

/** Edit each section's name, entry type and who is in it. */
export function SectionListEditor({ sections, onChange }: SectionListEditorProps) {
  const theme = useTheme();

  function update(index: number, patch: Partial<SectionSpec>) {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Sections</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Groups of rows down the side. Choose what kind of entry goes in each one.
      </ThemedText>

      {sections.map((section, index) => (
        <ThemedView key={index} type="backgroundElement" style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleInput}>
              <TextField
                accessibilityLabel={`Name of section ${index + 1}`}
                value={section.title}
                onChangeText={(title) => update(index, { title })}
                placeholder={`Section ${index + 1}, e.g. Chores`}
                maxLength={40}
                style={{ backgroundColor: theme.background }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove section ${section.title || index + 1}`}
              hitSlop={8}
              onPress={() => onChange(sections.filter((_, i) => i !== index))}>
              <ThemedText themeColor="textSecondary" style={styles.remove}>
                ×
              </ThemedText>
            </Pressable>
          </View>

          <SegmentedControl<CellType>
            segments={[
              { value: 'option', label: 'Choice' },
              { value: 'text', label: 'Text' },
            ]}
            value={section.cellType}
            onChange={(cellType) => update(index, { cellType })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {section.cellType === 'option'
              ? 'Tap a cell to pick one of the choices below, e.g. Y or N.'
              : 'Type anything in a cell, e.g. “Dad 2–5pm”.'}
          </ThemedText>

          <View style={styles.switchRow}>
            <ThemedText type="small" style={styles.switchLabel}>
              Add everyone in the group
            </ThemedText>
            <Switch
              accessibilityLabel={`Add everyone in the group to ${section.title || `section ${index + 1}`}`}
              value={section.rows === 'members'}
              onValueChange={(on) => update(index, { rows: on ? 'members' : [] })}
            />
          </View>
        </ThemedView>
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={() => onChange([...sections, NEW_SECTION])}
        style={styles.addLink}>
        <ThemedText type="small" style={{ color: theme.tint }}>
          + Add a section
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  titleInput: {
    flex: 1,
  },
  remove: {
    fontSize: 22,
    paddingHorizontal: Spacing.one,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  switchLabel: {
    flex: 1,
  },
  addLink: {
    paddingVertical: Spacing.two,
  },
});
