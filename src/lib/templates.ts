// Pure helpers that describe what each page template creates.
// No React Native or Supabase imports, so this is easy to test.

export type CellType = 'option' | 'text';

export type OptionSpec = { value: string; label: string; colour: string };
export type ColumnSpec = { label: string; date: string | null };
export type SectionSpec = {
  title: string;
  cellType: CellType;
  notify: boolean;
  /**
   * 'members' keeps one row per group member, added and removed as people
   * join and leave; otherwise these fixed labels, e.g. a shared "Car" row.
   */
  rows: 'members' | string[];
};

export type ColumnMode = 'weekdays' | 'dates' | 'custom';

export type TemplateSpec = {
  template: 'meal_plan' | 'roster' | 'blank';
  columnMode: ColumnMode;
  instructions: string;
  columns: ColumnSpec[];
  options: OptionSpec[];
  sections: SectionSpec[];
  /**
   * Put everyone in the group in every section (e.g. meals). When off
   * (e.g. rosters), people choose the sections they're in.
   */
  everyone: boolean;
};

/** How a page's columns are chosen in the page builder. */
export type ColumnChoice =
  | { kind: 'weekdays' }
  | { kind: 'dates'; year: number; month: number; weekdays: number[] }
  | { kind: 'custom'; labels: string[] };

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Each is dark enough for white letters (about 5:1 contrast or better),
// since choices are drawn as solid tiles in light and dark mode.
export const COLOURS = {
  green: '#15803D',
  red: '#DC2626',
  amber: '#B45309',
  blue: '#2563EB',
  purple: '#9333EA',
  grey: '#6B7280',
};

/** Letter colour on top of a choice colour. */
export const ON_CHOICE_COLOUR = '#ffffff';

/** Colours offered in the legend editor, in the order tapping cycles through. */
export const PALETTE = Object.values(COLOURS);

export function nextColour(colour: string) {
  return PALETTE[(PALETTE.indexOf(colour) + 1) % PALETTE.length];
}

export const OPTION_PRESETS: { name: string; options: OptionSpec[] }[] = [
  {
    name: 'Yes / No',
    options: [
      { value: 'Y', label: 'Yes', colour: COLOURS.green },
      { value: 'N', label: 'No', colour: COLOURS.red },
    ],
  },
  {
    name: 'Yes / No / Maybe',
    options: [
      { value: 'Y', label: 'Yes', colour: COLOURS.green },
      { value: 'N', label: 'No', colour: COLOURS.red },
      { value: '?', label: 'Maybe', colour: COLOURS.amber },
    ],
  },
  {
    name: 'Tick',
    options: [{ value: '✓', label: 'Done', colour: COLOURS.green }],
  },
];

/** Short code shown in each cell, e.g. "Y". */
export const MAX_OPTION_VALUE_LENGTH = 3;

// --- Dates -----------------------------------------------------------------

/** Monday = 0 … Sunday = 6 (JavaScript's getDay() starts on Sunday). */
export function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

/** 'YYYY-MM-DD' in local time (toISOString would shift to UTC). */
export function toDateString(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseDateString(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** e.g. { weekday: 'Fri', day: '6 Nov' } for column headers. */
export function formatColumnDate(value: string) {
  const date = parseDateString(value);
  return {
    weekday: WEEKDAYS[weekdayIndex(date)],
    day: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
  };
}

export type MonthChoice = { year: number; month: number; label: string };

/** This month and the next `count - 1` months: a full year by default. */
export function upcomingMonths(from: Date, count = 12): MonthChoice[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTHS_LONG[d.getMonth()] };
  });
}

/** Every date in the month that falls on one of the chosen weekdays. */
export function datesInMonth(year: number, month: number, weekdays: number[]) {
  const dates: Date[] = [];
  for (let d = new Date(year, month, 1); d.getMonth() === month; d.setDate(d.getDate() + 1)) {
    if (weekdays.includes(weekdayIndex(d))) dates.push(new Date(d));
  }
  return dates;
}

// --- Columns ---------------------------------------------------------------

export function buildColumns(choice: ColumnChoice): { columnMode: ColumnMode; columns: ColumnSpec[] } {
  switch (choice.kind) {
    case 'weekdays':
      return { columnMode: 'weekdays', columns: WEEKDAYS.map((label) => ({ label, date: null })) };
    case 'dates':
      return {
        columnMode: 'dates',
        columns: datesInMonth(choice.year, choice.month, choice.weekdays).map((date) => {
          const value = toDateString(date);
          const { weekday, day } = formatColumnDate(value);
          return { label: `${day} (${weekday})`, date: value };
        }),
      };
    case 'custom':
      return {
        columnMode: 'custom',
        columns: choice.labels.map((label) => ({ label, date: null })),
      };
  }
}

// --- Templates -------------------------------------------------------------

export const MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const;
export type Meal = (typeof MEALS)[number];

export function mealPlanTemplate(meals: Meal[], includeCarUse: boolean): TemplateSpec {
  return {
    template: 'meal_plan',
    everyone: true,
    ...buildColumns({ kind: 'weekdays' }),
    instructions: 'Y = eating at home, N = not eating at home.',
    options: [
      { value: 'Y', label: 'Eating', colour: COLOURS.green },
      { value: 'N', label: 'Not eating', colour: COLOURS.red },
    ],
    sections: [
      // Keep breakfast → lunch → dinner order however they were picked.
      ...MEALS.filter((m) => meals.includes(m)).map((title) => ({
        title,
        cellType: 'option' as const,
        notify: false,
        rows: 'members' as const,
      })),
      ...(includeCarUse
        ? [{ title: 'Car use', cellType: 'text' as const, notify: true, rows: ['Car'] }]
        : []),
    ],
  };
}

export const DEFAULT_ROSTER_SECTIONS = [
  'Vocalists',
  'Guitarists',
  'Keyboardists',
  'Bassists',
  'Drummers',
];

export function rosterTemplate(
  year: number,
  month: number,
  weekdays: number[],
  sectionTitles: string[],
): TemplateSpec {
  return {
    template: 'roster',
    // Not everyone plays every instrument.
    everyone: false,
    ...buildColumns({ kind: 'dates', year, month, weekdays }),
    // Every date gets an answer, so a blank cell means "not answered yet".
    instructions: "Y = I'd prefer to serve on this date\nA = I'm available\nN = I'm not available",
    options: [
      { value: 'Y', label: 'Prefer', colour: COLOURS.green },
      { value: 'A', label: 'Available', colour: COLOURS.blue },
      { value: 'N', label: 'Not available', colour: COLOURS.red },
    ],
    sections: sectionTitles.map((title) => ({
      title,
      cellType: 'option' as const,
      notify: false,
      rows: 'members' as const,
    })),
  };
}

/** A page designed from scratch in the page builder. */
export type CustomDraft = {
  columns: ColumnChoice;
  options: OptionSpec[];
  sections: SectionSpec[];
  instructions: string;
};

export function customTemplate(draft: CustomDraft): TemplateSpec {
  const usesChoices = draft.sections.some((s) => s.cellType === 'option');
  return {
    template: 'blank',
    everyone: true,
    ...buildColumns(draft.columns),
    instructions: draft.instructions.trim(),
    // Drop half-filled legend entries; skip the legend if nothing uses it.
    options: usesChoices ? draft.options.filter((o) => o.value.trim()) : [],
    sections: draft.sections.map((s) => ({ ...s, title: s.title.trim() })),
  };
}

/** Returns a message describing the first problem with a spec, or null. */
export function validateSpec(spec: TemplateSpec): string | null {
  if (spec.columns.length === 0) {
    return spec.columnMode === 'custom' ? 'Add at least one column.' : 'Pick at least one day.';
  }
  if (spec.sections.length === 0) return 'Add at least one section.';
  if (spec.sections.some((s) => !s.title)) return 'Every section needs a name.';
  const titles = spec.sections.map((s) => s.title.toLowerCase());
  if (new Set(titles).size !== titles.length) return 'Section names must be different.';

  if (spec.sections.some((s) => s.cellType === 'option')) {
    if (spec.options.length === 0) return 'Add at least one choice for your choice sections.';
    const values = spec.options.map((o) => o.value.trim().toUpperCase());
    if (new Set(values).size !== values.length) return 'Each choice needs a different short code.';
  }
  return null;
}
