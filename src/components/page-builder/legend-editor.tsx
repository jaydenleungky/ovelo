import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MAX_OPTION_VALUE_LENGTH,
  ON_CHOICE_COLOUR,
  OPTION_PRESETS,
  PALETTE,
  nextColour,
  type OptionSpec,
} from '@/lib/templates';

type LegendEditorProps = {
  options: OptionSpec[];
  onChange: (options: OptionSpec[]) => void;
};

function sameOptions(a: OptionSpec[], b: OptionSpec[]) {
  return a.length === b.length && a.every((o, i) => o.value === b[i].value && o.label === b[i].label);
}

/** Edit the choices people can pick in a cell: a short code, a meaning and a colour. */
export function LegendEditor({ options, onChange }: LegendEditorProps) {
  const theme = useTheme();

  function update(index: number, patch: Partial<OptionSpec>) {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addChoice() {
    const used = new Set(options.map((o) => o.colour));
    const colour = PALETTE.find((c) => !used.has(c)) ?? PALETTE[0];
    onChange([...options, { value: '', label: '', colour }]);
  }

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Choices</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        What people can pick in a choice section. Start from a preset or make your own. Tap a
        colour to change it.
      </ThemedText>

      <View style={styles.chips}>
        {OPTION_PRESETS.map((preset) => (
          <Chip
            key={preset.name}
            label={preset.name}
            selected={sameOptions(options, preset.options)}
            onPress={() => onChange(preset.options)}
          />
        ))}
      </View>

      {options.map((option, index) => (
        <View key={index} style={styles.optionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change colour of ${option.label || `choice ${index + 1}`}`}
            onPress={() => update(index, { colour: nextColour(option.colour) })}
            style={[styles.swatch, { backgroundColor: option.colour }]}>
            <ThemedText type="smallBold" style={{ color: ON_CHOICE_COLOUR }}>
              {option.value || '·'}
            </ThemedText>
          </Pressable>
          <View style={styles.codeInput}>
            <TextField
              accessibilityLabel={`Short code for choice ${index + 1}`}
              value={option.value}
              onChangeText={(value) => update(index, { value })}
              placeholder="Y"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={MAX_OPTION_VALUE_LENGTH}
              style={styles.centered}
            />
          </View>
          <View style={styles.labelInput}>
            <TextField
              accessibilityLabel={`Meaning of choice ${index + 1}`}
              value={option.label}
              onChangeText={(label) => update(index, { label })}
              placeholder="What it means"
              maxLength={30}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove choice ${index + 1}`}
            hitSlop={8}
            onPress={() => onChange(options.filter((_, i) => i !== index))}>
            <ThemedText themeColor="textSecondary" style={styles.remove}>
              ×
            </ThemedText>
          </Pressable>
        </View>
      ))}

      <Pressable accessibilityRole="button" onPress={addChoice} style={styles.addLink}>
        <ThemedText type="small" style={{ color: theme.link, fontWeight: 600 }}>
          + Add a choice
        </ThemedText>
      </Pressable>
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: {
    width: 64,
  },
  centered: {
    textAlign: 'center',
  },
  labelInput: {
    flex: 1,
  },
  remove: {
    fontSize: 22,
    paddingHorizontal: Spacing.one,
  },
  addLink: {
    paddingVertical: Spacing.two,
  },
});
