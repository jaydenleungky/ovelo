import { Fragment, useCallback, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Column, Option, PageData, Row, Section } from '@/lib/pages';
import {
  COLOURS,
  ON_CHOICE_COLOUR,
  formatColumnDate,
  toDateString,
  weekdayIndex,
} from '@/lib/templates';

const NAME_WIDTH = 136;
const COLUMN_WIDTH = 64;
// Custom labels like "Week 1" need a little more room than "Mon".
const CUSTOM_COLUMN_WIDTH = 88;

const HEADER_HEIGHT = 52;
const SECTION_HEIGHT = 36;
const ROW_HEIGHT = 44;

function columnWidth(columnMode: PageData['page']['column_mode']) {
  return columnMode === 'custom' ? CUSTOM_COLUMN_WIDTH : COLUMN_WIDTH;
}

/** Total width of the grid, to tell whether it fits on screen. */
export function gridWidth(data: PageData) {
  return NAME_WIDTH + data.columns.length * columnWidth(data.page.column_mode);
}

/**
 * The grid is split into a header and a body so the screen can make the
 * header sticky. Both scroll sideways together: the body drives the header.
 */
export function useGridScrollSync() {
  const headerRef = useRef<ScrollViewInstance>(null);
  const onBodyScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    headerRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
  }, []);
  return { headerRef, onBodyScroll };
}

function isToday(column: Column, columnMode: PageData['page']['column_mode'], today: Date) {
  if (columnMode === 'weekdays') return column.position === weekdayIndex(today);
  if (columnMode === 'dates') return column.date === toDateString(today);
  return false;
}

type HeaderProps = {
  data: PageData;
  headerRef: React.RefObject<ScrollViewInstance | null>;
};

export function GridHeader({ data, headerRef }: HeaderProps) {
  const theme = useTheme();
  const today = new Date();

  return (
    <View
      style={[styles.headerRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={[styles.nameCell, styles.headerCorner]} />
      <ScrollView
        ref={headerRef}
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}>
        {data.columns.map((column) => {
          const highlight = isToday(column, data.page.column_mode, today);
          const { weekday, day } = column.date
            ? formatColumnDate(column.date)
            : { weekday: column.label, day: '' };
          return (
            <View
              key={column.id}
              accessibilityLabel={`${column.label}${highlight ? ', today' : ''}`}
              style={[
                styles.headerCell,
                { width: columnWidth(data.page.column_mode) },
                highlight && { backgroundColor: theme.tint },
              ]}>
              <ThemedText
                type="smallBold"
                numberOfLines={2}
                style={[styles.headerText, { color: highlight ? theme.onTint : theme.text }]}>
                {weekday}
              </ThemedText>
              {day !== '' && (
                <ThemedText
                  type="small"
                  style={{ color: highlight ? theme.onTint : theme.textSecondary }}>
                  {day}
                </ThemedText>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

type BodyProps = {
  data: PageData;
  currentUserId: string | undefined;
  canEditLayout: boolean;
  onBodyScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onAddRow: (sectionId: string, sectionTitle: string) => void;
  onCellPress: (row: Row, column: Column, section: Section) => void;
  onCellLongPress: (row: Row, column: Column, section: Section) => void;
};

export function GridBody({
  data,
  currentUserId,
  canEditLayout,
  onBodyScroll,
  onAddRow,
  onCellPress,
  onCellLongPress,
}: BodyProps) {
  const theme = useTheme();
  const today = new Date();

  const optionsByValue = new Map(data.options.map((o) => [o.value, o]));
  const cellValues = new Map(data.cells.map((c) => [`${c.row_id}:${c.column_id}`, c.value]));
  const rowsBySection = new Map<string, Row[]>();
  for (const row of data.rows) {
    rowsBySection.set(row.section_id, [...(rowsBySection.get(row.section_id) ?? []), row]);
  }
  const todayColumnId = data.columns.find((c) => isToday(c, data.page.column_mode, today))?.id;
  const width = columnWidth(data.page.column_mode);
  const line = { borderColor: theme.border };

  // A solid tile filling the cell, with a thin gap so neighbours stay separate.
  function renderOptionCell(option: Option | undefined, value: string) {
    if (!value) return null;
    return (
      <View
        style={[
          styles.choiceTile,
          { backgroundColor: option?.colour ?? theme.backgroundSelected },
        ]}>
        <ThemedText
          type="smallBold"
          style={{ color: option ? ON_CHOICE_COLOUR : theme.text }}>
          {value}
        </ThemedText>
      </View>
    );
  }

  const left: React.ReactNode[] = [];
  const right: React.ReactNode[] = [];

  for (const section of data.sections) {
    const rows = rowsBySection.get(section.id) ?? [];

    left.push(
      <View
        key={`s-${section.id}`}
        style={[styles.nameCell, styles.sectionCell, line, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {section.title}
        </ThemedText>
      </View>,
    );
    right.push(
      <View
        key={`s-${section.id}`}
        style={[
          styles.sectionCell,
          line,
          { backgroundColor: theme.backgroundSelected, width: data.columns.length * width },
        ]}
      />,
    );

    for (const row of rows) {
      const isMine = !!currentUserId && row.user_id === currentUserId;
      left.push(
        <View key={row.id} style={[styles.nameCell, styles.rowCell, line]}>
          {isMine && <View style={[styles.meDot, { backgroundColor: theme.tint }]} />}
          <ThemedText
            type={isMine ? 'smallBold' : 'small'}
            numberOfLines={1}
            style={styles.nameText}>
            {row.label}
          </ThemedText>
          {data.page.track_done && row.is_done && (
            <ThemedText type="smallBold" style={{ color: COLOURS.green }} accessibilityLabel="done">
              ✓
            </ThemedText>
          )}
        </View>,
      );
      right.push(
        <View key={row.id} style={styles.cellRow}>
          {data.columns.map((column) => {
            const value = cellValues.get(`${row.id}:${column.id}`) ?? '';
            return (
              <Pressable
                key={column.id}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}, ${column.label}: ${value || 'blank'}`}
                onPress={() => onCellPress(row, column, section)}
                onLongPress={() => onCellLongPress(row, column, section)}
                style={({ pressed }) => [
                  styles.cell,
                  { width },
                  line,
                  column.id === todayColumnId && { backgroundColor: theme.backgroundElement },
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}>
                {section.cell_type === 'option' ? (
                  renderOptionCell(optionsByValue.get(value), value)
                ) : (
                  <ThemedText type="small" numberOfLines={2} style={styles.cellText}>
                    {value}
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
        </View>,
      );
    }

    if (rows.length === 0 && !canEditLayout) {
      left.push(
        <View key={`e-${section.id}`} style={[styles.nameCell, styles.rowCell, line]}>
          <ThemedText type="small" themeColor="textSecondary">
            No one yet
          </ThemedText>
        </View>,
      );
      right.push(<View key={`e-${section.id}`} style={[styles.rowCell, line, { width: data.columns.length * width }]} />);
    }

    if (canEditLayout) {
      left.push(
        <Pressable
          key={`a-${section.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Add person to ${section.title}`}
          onPress={() => onAddRow(section.id, section.title)}
          style={({ pressed }) => [styles.nameCell, styles.rowCell, line, pressed && styles.pressed]}>
          <ThemedText type="small" style={{ color: theme.tint }}>
            + Add person
          </ThemedText>
        </Pressable>,
      );
      right.push(<View key={`a-${section.id}`} style={[styles.rowCell, line, { width: data.columns.length * width }]} />);
    }
  }

  return (
    <View style={styles.body}>
      <View style={[styles.nameColumn, { borderColor: theme.border }]}>
        {left.map((node, i) => (
          <Fragment key={i}>{node}</Fragment>
        ))}
      </View>
      <ScrollView
        horizontal
        onScroll={onBodyScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}>
        <View>
          {right.map((node, i) => (
            <Fragment key={i}>{node}</Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** The colour key, e.g. "Y Prefer · N Not available". */
export function Legend({ options, blankLabel }: { options: Option[]; blankLabel?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.legend}>
      {options.map((option) => (
        <View key={option.id} style={styles.legendItem}>
          <View style={[styles.legendTile, { backgroundColor: option.colour }]}>
            <ThemedText type="smallBold" style={{ color: ON_CHOICE_COLOUR }}>
              {option.value}
            </ThemedText>
          </View>
          <ThemedText type="small">{option.label}</ThemedText>
        </View>
      ))}
      {blankLabel && (
        <View style={styles.legendItem}>
          <View style={[styles.legendTile, { borderWidth: 1, borderColor: theme.border }]} />
          <ThemedText type="small">{blankLabel}</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  headerCorner: {
    flexShrink: 0,
    height: HEADER_HEIGHT,
  },
  headerCell: {
    flexShrink: 0,
    height: HEADER_HEIGHT,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  headerText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 16,
  },
  body: {
    flexDirection: 'row',
  },
  nameColumn: {
    flexShrink: 0,
    width: NAME_WIDTH,
    borderRightWidth: 1,
  },
  nameCell: {
    flexShrink: 0,
    width: NAME_WIDTH,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  nameText: {
    flexShrink: 1,
  },
  sectionCell: {
    height: SECTION_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowCell: {
    height: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cellRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
  },
  cell: {
    flexShrink: 0,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cellText: {
    paddingHorizontal: Spacing.one,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  choiceTile: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendTile: {
    minWidth: 32,
    height: 28,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pressed: {
    opacity: 0.6,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
