import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ChipListEditor } from '@/components/page-builder/chip-list-editor';
import { ColumnPicker, MonthDaysPicker } from '@/components/page-builder/column-picker';
import { LegendEditor } from '@/components/page-builder/legend-editor';
import { NEW_SECTION, SectionListEditor } from '@/components/page-builder/section-list-editor';
import { TextField } from '@/components/text-field';
import { ScreenFade } from '@/components/screen-fade';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';
import { createPageFromTemplate } from '@/lib/pages';
import {
  DEFAULT_ROSTER_SECTIONS,
  MEALS,
  OPTION_PRESETS,
  customTemplate,
  mealPlanTemplate,
  rosterTemplate,
  upcomingMonths,
  validateSpec,
  type CustomDraft,
  type Meal,
} from '@/lib/templates';

type TemplateKind = 'meal_plan' | 'roster' | 'custom';

const TEMPLATE_CARDS: { kind: TemplateKind; emoji: string; title: string; blurb: string }[] = [
  {
    kind: 'meal_plan',
    emoji: '🍽️',
    title: 'Meal plan',
    blurb: 'Who’s eating at home each day, plus car use.',
  },
  {
    kind: 'roster',
    emoji: '🎵',
    title: 'Roster',
    blurb: 'Who can serve on which dates, by role or instrument.',
  },
  {
    kind: 'custom',
    emoji: '✏️',
    title: 'Custom',
    blurb: 'Design your own columns, sections and choices.',
  },
];

const FRI = 4;
const SAT = 5;

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function NewPageScreen() {
  const theme = useTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const months = useMemo(() => upcomingMonths(new Date()), []);

  const [kind, setKind] = useState<TemplateKind>('meal_plan');
  const [title, setTitle] = useState('');

  // Meal plan
  const [meals, setMeals] = useState<Meal[]>(['Lunch', 'Dinner']);
  const [carUse, setCarUse] = useState(true);

  // Roster
  const [rosterDates, setRosterDates] = useState({
    kind: 'dates' as const,
    year: months[0].year,
    month: months[0].month,
    weekdays: [FRI, SAT],
  });
  const [rosterSections, setRosterSections] = useState<string[]>(DEFAULT_ROSTER_SECTIONS);

  // Custom
  const [custom, setCustom] = useState<CustomDraft>({
    columns: { kind: 'weekdays' },
    options: OPTION_PRESETS[0].options,
    sections: [NEW_SECTION],
    instructions: '',
  });

  // null = use the template's default (on for meals, off for rosters).
  const [everyoneChoice, setEveryoneChoice] = useState<boolean | null>(null);
  // Mon–Sun pages: show each week's dates, with fresh answers every week.
  const [weeklyDates, setWeeklyDates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rosterMonth = months.find(
    (m) => m.year === rosterDates.year && m.month === rosterDates.month,
  );
  const spec =
    kind === 'meal_plan'
      ? mealPlanTemplate(meals, carUse)
      : kind === 'roster'
        ? rosterTemplate(rosterDates.year, rosterDates.month, rosterDates.weekdays, rosterSections)
        : customTemplate(custom);
  const defaultTitle =
    kind === 'meal_plan'
      ? 'Meal plan'
      : kind === 'roster'
        ? `${rosterMonth?.label ?? ''} roster`
        : 'New page';
  const usesChoices = custom.sections.some((s) => s.cellType === 'option');
  const everyone = everyoneChoice ?? spec.everyone;

  const columnWord = spec.columnMode === 'weekdays' ? 'days' : spec.columnMode === 'dates' ? 'dates' : 'columns';
  const summary = `${spec.columns.length} ${columnWord} · ${spec.sections.length} ${
    spec.sections.length === 1 ? 'section' : 'sections'
  }`;

  async function handleCreate() {
    const problem = validateSpec(spec);
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    try {
      const pageId = await createPageFromTemplate(groupId, title.trim() || defaultTitle, {
        ...spec,
        everyone,
        weeklyDates: spec.columnMode === 'weekdays' && weeklyDates,
      });
      router.replace(`/pages/${pageId}`);
    } catch (e) {
      setError(friendlyError(e, 'Could not create the page.'));
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenFade />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <ThemedText type="smallBold">Start from</ThemedText>
          {TEMPLATE_CARDS.map((card) => {
            const selected = card.kind === kind;
            return (
              <Pressable
                key={card.kind}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  setKind(card.kind);
                  setEveryoneChoice(null);
                  setError(null);
                }}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: selected ? theme.tint : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.emoji}>{card.emoji}</ThemedText>
                <View style={styles.cardText}>
                  <ThemedText type="smallBold">{card.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {card.blurb}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Page name"
          value={title}
          onChangeText={setTitle}
          placeholder={defaultTitle}
          maxLength={60}
        />

        {kind === 'meal_plan' && (
          <>
            <View style={styles.group}>
              <ThemedText type="smallBold">Meals</ThemedText>
              <View style={styles.chips}>
                {MEALS.map((meal) => (
                  <Chip
                    key={meal}
                    label={meal}
                    selected={meals.includes(meal)}
                    onPress={() => setMeals(toggle(meals, meal))}
                  />
                ))}
              </View>
            </View>

            <ThemedView type="backgroundElement" style={styles.switchRow}>
              <View style={styles.switchText}>
                <ThemedText type="smallBold">Car use row</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Note who has the car each day, e.g. “Dad 2–5pm”.
                </ThemedText>
              </View>
              <Switch value={carUse} onValueChange={setCarUse} accessibilityLabel="Car use row" />
            </ThemedView>
          </>
        )}

        {kind === 'roster' && (
          <>
            <MonthDaysPicker months={months} value={rosterDates} onChange={setRosterDates} />
            <View style={styles.group}>
              <ThemedText type="smallBold">Sections</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Tap a section to remove it. You&apos;ll add people to each one next.
              </ThemedText>
              <ChipListEditor
                items={rosterSections}
                onChange={setRosterSections}
                addLabel="Add a section"
                placeholder="e.g. Helpers"
              />
            </View>
          </>
        )}

        {kind === 'custom' && (
          <>
            <ColumnPicker
              months={months}
              value={custom.columns}
              onChange={(columns) => setCustom({ ...custom, columns })}
            />
            <SectionListEditor
              sections={custom.sections}
              onChange={(sections) => setCustom({ ...custom, sections })}
            />
            {usesChoices && (
              <LegendEditor
                options={custom.options}
                onChange={(options) => setCustom({ ...custom, options })}
              />
            )}
            <TextField
              label="Instructions (optional)"
              value={custom.instructions}
              onChangeText={(instructions) => setCustom({ ...custom, instructions })}
              placeholder="e.g. Put your name down for one chore each week."
              multiline
              maxLength={500}
              style={styles.multiline}
            />
          </>
        )}

        {spec.columnMode === 'weekdays' && (
          <ThemedView type="backgroundElement" style={styles.switchRow}>
            <View style={styles.switchText}>
              <ThemedText type="smallBold">Dates for each week</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {weeklyDates
                  ? 'Shows this week’s dates. Each week starts empty, and past weeks are kept to look back on.'
                  : 'The same plan every week, without dates.'}
              </ThemedText>
            </View>
            <Switch
              value={weeklyDates}
              onValueChange={setWeeklyDates}
              accessibilityLabel="Dates for each week"
            />
          </ThemedView>
        )}

        <ThemedView type="backgroundElement" style={styles.switchRow}>
          <View style={styles.switchText}>
            <ThemedText type="smallBold">Everyone in every section</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {everyone
                ? 'Everyone in the group gets a row in each section, including people who join later.'
                : 'Sections start empty. People tap a section’s title to add themselves, e.g. only the instruments they play.'}
            </ThemedText>
          </View>
          <Switch
            value={everyone}
            onValueChange={setEveryoneChoice}
            accessibilityLabel="Everyone in every section"
          />
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
          {summary}
        </ThemedText>

        {error && (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
            {error}
          </ThemedText>
        )}

        <Button title="Create page" onPress={handleCreate} loading={submitting} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  cardText: {
    flex: 1,
    gap: Spacing.half,
  },
  emoji: {
    fontSize: 28,
    lineHeight: 36,
  },
  pressed: {
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  switchText: {
    flex: 1,
    gap: Spacing.half,
  },
  multiline: {
    minHeight: 88,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  summary: {
    textAlign: 'center',
  },
});
