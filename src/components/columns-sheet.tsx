import { useState } from 'react';
import {
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
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Column, ColumnEdit } from '@/lib/pages';
import {
  WEEKDAYS,
  dateColumnLabel,
  datesInMonth,
  parseDateString,
  toDateString,
  upcomingMonths,
  weekdayIndex,
  type ColumnMode,
  type MonthChoice,
} from '@/lib/templates';

type ColumnsSheetProps = {
  columnMode: ColumnMode;
  columns: Column[];
  onSave: (next: ColumnEdit[]) => void;
  onClose: () => void;
};

const MAX_LABEL_LENGTH = 20;

/** Edit what goes across the top of a page. Nothing changes until Save. */
export function ColumnsSheet({ columnMode, columns, onSave, onClose }: ColumnsSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [next, setNext] = useState<ColumnEdit[]>(columns);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (next.length === 0) return setError('A page needs at least one column.');
    const labels = next.map((c) => c.label.trim());
    if (labels.some((l) => !l)) return setError('Every column needs a name.');
    onSave(next.map((c, i) => ({ ...c, label: labels[i] })));
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
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="smallBold">Columns</ThemedText>

            {columnMode === 'weekdays' && (
              <WeekdayPicker
                value={next}
                onChange={(value) => {
                  setNext(value);
                  setError(null);
                }}
              />
            )}
            {columnMode === 'dates' && (
              <DatePicker
                original={columns}
                value={next}
                onChange={(value) => {
                  setNext(value);
                  setError(null);
                }}
              />
            )}
            {columnMode === 'custom' && (
              <LabelEditor
                value={next}
                onChange={(value) => {
                  setNext(value);
                  setError(null);
                }}
              />
            )}

            {error && (
              <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
                {error}
              </ThemedText>
            )}

            <View style={styles.actions}>
              <Button title="Save" onPress={save} />
              <Button title="Cancel" variant="secondary" onPress={onClose} />
            </View>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type PickerProps = { value: ColumnEdit[]; onChange: (value: ColumnEdit[]) => void };

/** Mon–Sun pages: choose which days show. Each day keeps its weekday as its position. */
function WeekdayPicker({ value, onChange }: PickerProps) {
  function toggle(day: number) {
    const existing = value.find((c) => c.position === day);
    const updated = existing
      ? value.filter((c) => c !== existing)
      : [...value, { position: day, label: WEEKDAYS[day], date: null }];
    onChange(updated.sort((a, b) => a.position - b.position));
  }

  return (
    <View style={styles.group}>
      <ThemedText type="small" themeColor="textSecondary">
        Tap a day to show or hide it.
      </ThemedText>
      <View style={styles.chips}>
        {WEEKDAYS.map((day, i) => (
          <Chip
            key={day}
            label={day}
            selected={value.some((c) => c.position === i)}
            onPress={() => toggle(i)}
          />
        ))}
      </View>
    </View>
  );
}

function sameMonth(a: MonthChoice, b: MonthChoice) {
  return a.year === b.year && a.month === b.month;
}

/** Date pages: pick dates from any month. Columns stay in date order. */
function DatePicker({ original, value, onChange }: PickerProps & { original: Column[] }) {
  // The months the page already covers, plus the year ahead.
  const [months] = useState(() => {
    const list: MonthChoice[] = [];
    const add = (d: Date) => {
      const m = upcomingMonths(d, 1)[0];
      if (!list.some((x) => sameMonth(x, m))) list.push(m);
    };
    for (const c of original) if (c.date) add(parseDateString(c.date));
    upcomingMonths(new Date()).forEach((m) => add(new Date(m.year, m.month, 1)));
    return list.sort((a, b) => a.year - b.year || a.month - b.month);
  });
  const firstDate = original.find((c) => c.date)?.date;
  const [shown, setShown] = useState<MonthChoice>(() =>
    firstDate ? upcomingMonths(parseDateString(firstDate), 1)[0] : months[0],
  );

  function toggle(date: string) {
    const existing = value.find((c) => c.date === date);
    const updated = existing
      ? value.filter((c) => c !== existing)
      : [...value, { position: 0, label: dateColumnLabel(date), date }];
    onChange(
      updated
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
        .map((c, position) => ({ ...c, position })),
    );
  }

  const days = datesInMonth(shown.year, shown.month, [0, 1, 2, 3, 4, 5, 6]);
  const showYear = months.some((m) => m.year !== months[0].year);

  return (
    <View style={styles.group}>
      <ThemedText type="small" themeColor="textSecondary">
        Pick a month, then tap dates to add or remove them. {value.length}{' '}
        {value.length === 1 ? 'date' : 'dates'} picked.
      </ThemedText>
      <View style={styles.chips}>
        {months.map((m) => (
          <Chip
            key={`${m.year}-${m.month}`}
            label={showYear ? `${m.label} ${m.year}` : m.label}
            selected={sameMonth(m, shown)}
            onPress={() => setShown(m)}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {days.map((d) => {
          const date = toDateString(d);
          return (
            <Chip
              key={date}
              label={`${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()}`}
              selected={value.some((c) => c.date === date)}
              onPress={() => toggle(date)}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Custom pages: rename, remove or add columns. */
function LabelEditor({ value, onChange }: PickerProps) {
  const theme = useTheme();
  const renumber = (list: ColumnEdit[]) => list.map((c, position) => ({ ...c, position }));

  return (
    <View style={styles.group}>
      {value.map((column, index) => (
        <View key={column.id ?? `new-${index}`} style={styles.labelRow}>
          <View style={styles.labelInput}>
            <TextField
              accessibilityLabel={`Column ${index + 1}`}
              value={column.label}
              onChangeText={(label) =>
                onChange(value.map((c, i) => (i === index ? { ...c, label } : c)))
              }
              placeholder={`Column ${index + 1}`}
              maxLength={MAX_LABEL_LENGTH}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${column.label || `column ${index + 1}`}`}
            hitSlop={8}
            onPress={() => onChange(renumber(value.filter((_, i) => i !== index)))}>
            <ThemedText themeColor="textSecondary" style={styles.remove}>
              ×
            </ThemedText>
          </Pressable>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange([...value, { position: value.length, label: '', date: null }])}
        style={styles.addLink}>
        <ThemedText type="small" style={{ color: theme.tint }}>
          + Add a column
        </ThemedText>
      </Pressable>
    </View>
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
    maxHeight: '85%',
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
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  actions: {
    gap: Spacing.two,
  },
});
