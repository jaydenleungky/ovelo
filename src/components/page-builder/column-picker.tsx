import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ChipListEditor } from '@/components/page-builder/chip-list-editor';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { WEEKDAYS, type ColumnChoice, type MonthChoice } from '@/lib/templates';

type DatesChoice = Extract<ColumnChoice, { kind: 'dates' }>;

type MonthDaysPickerProps = {
  months: MonthChoice[];
  value: DatesChoice;
  onChange: (value: DatesChoice) => void;
};

/** Pick a month and which weekdays in it become columns. */
export function MonthDaysPicker({ months, value, onChange }: MonthDaysPickerProps) {
  function toggleDay(day: number) {
    const weekdays = value.weekdays.includes(day)
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day];
    onChange({ ...value, weekdays });
  }

  return (
    <>
      <View style={styles.group}>
        <ThemedText type="smallBold">Month</ThemedText>
        <View style={styles.chips}>
          {months.map((m) => (
            <Chip
              key={`${m.year}-${m.month}`}
              label={m.label}
              selected={m.year === value.year && m.month === value.month}
              onPress={() => onChange({ ...value, year: m.year, month: m.month })}
            />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <ThemedText type="smallBold">Days</ThemedText>
        <View style={styles.chips}>
          {WEEKDAYS.map((day, i) => (
            <Chip
              key={day}
              label={day}
              selected={value.weekdays.includes(i)}
              onPress={() => toggleDay(i)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

type ColumnPickerProps = {
  months: MonthChoice[];
  value: ColumnChoice;
  onChange: (value: ColumnChoice) => void;
};

const DEFAULT_DATES = { weekdays: [5, 6] }; // Sat, Sun
const DEFAULT_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

/** Choose what goes across the top of a page. */
export function ColumnPicker({ months, value, onChange }: ColumnPickerProps) {
  function switchKind(kind: ColumnChoice['kind']) {
    if (kind === value.kind) return;
    if (kind === 'weekdays') onChange({ kind });
    if (kind === 'dates') {
      onChange({ kind, year: months[0].year, month: months[0].month, ...DEFAULT_DATES });
    }
    if (kind === 'custom') onChange({ kind, labels: DEFAULT_LABELS });
  }

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Columns</ThemedText>
      <SegmentedControl
        segments={[
          { value: 'weekdays', label: 'Mon–Sun' },
          { value: 'dates', label: 'Dates' },
          { value: 'custom', label: 'My own' },
        ]}
        value={value.kind}
        onChange={switchKind}
      />
      {value.kind === 'weekdays' && (
        <ThemedText type="small" themeColor="textSecondary">
          One column for each day, Monday to Sunday. Good for things that repeat every week.
        </ThemedText>
      )}
      {value.kind === 'dates' && <MonthDaysPicker months={months} value={value} onChange={onChange} />}
      {value.kind === 'custom' && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Name each column yourself, e.g. weeks, terms or tasks. Tap one to remove it.
          </ThemedText>
          <ChipListEditor
            items={value.labels}
            onChange={(labels) => onChange({ kind: 'custom', labels })}
            addLabel="Add a column"
            placeholder="e.g. Week 5"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
