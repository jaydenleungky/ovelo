import { Fragment, useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Column, Option, PageData, Row, Section } from '@/lib/pages';
import {
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
// How long to hold a name before it can be dragged.
const DRAG_DELAY_MS = 300;

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
  /** Admins: tap any column header to edit the columns. */
  onColumnsPress?: () => void;
};

export function GridHeader({ data, headerRef, onColumnsPress }: HeaderProps) {
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
            <Pressable
              key={column.id}
              disabled={!onColumnsPress}
              accessibilityRole={onColumnsPress ? 'button' : 'header'}
              accessibilityLabel={`${column.label}${highlight ? ', today' : ''}${
                onColumnsPress ? '. Tap to edit columns.' : ''
              }`}
              onPress={onColumnsPress}
              style={({ pressed }) => [
                styles.headerCell,
                { width: columnWidth(data.page.column_mode) },
                highlight && { backgroundColor: theme.tint },
                pressed && styles.pressed,
              ]}>
              {/* Today's column glows from the accent into a brighter coral. */}
              {highlight && (
                <LinearGradient
                  colors={[theme.tint, theme.tintEnd]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              )}
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
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type NameCellProps = {
  row: Row;
  isMine: boolean;
  enabled: boolean;
  /** This name is being dragged. */
  dragging: boolean;
  /** How far to move aside while another name is dragged past. */
  shift: number;
  onPress: () => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: (drop: boolean) => void;
};

/** A person's name: tap to rename, or hold and slide up or down to reorder. */
function NameCell({
  row,
  isMine,
  enabled,
  dragging,
  shift,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
}: NameCellProps) {
  const theme = useTheme();
  const [offset] = useState(() => new Animated.Value(0));

  const pan = usePanGesture({
    enabled,
    runOnJS: true,
    activateAfterLongPress: DRAG_DELAY_MS,
    onActivate: () => {
      offset.setValue(0);
      onDragStart();
    },
    onUpdate: (e) => {
      offset.setValue(e.translationY);
      onDragMove(e.translationY);
    },
    onDeactivate: (e) => {
      offset.setValue(0);
      onDragEnd(!e.canceled);
    },
  });
  const tap = useTapGesture({ enabled, runOnJS: true, onActivate: onPress });
  const gesture = useExclusiveGestures(pan, tap);

  return (
    <GestureDetector gesture={gesture} userSelect="none">
      <Animated.View
        accessibilityRole={enabled ? 'button' : undefined}
        accessibilityLabel={enabled ? `${row.label}. Tap to rename, hold to move.` : row.label}
        style={[
          styles.nameCell,
          styles.rowCell,
          { borderColor: theme.border },
          dragging && [styles.dragging, { backgroundColor: theme.backgroundSelected }],
          { transform: [{ translateY: dragging ? offset : shift }] },
        ]}>
        <ThemedText type={isMine ? 'smallBold' : 'small'} numberOfLines={1} style={styles.nameText}>
          {row.label}
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

type SectionTitleProps = {
  title: string;
  /** Tap to open the section's sheet. */
  canTap: boolean;
  /** Admins: hold and slide up or down to move the whole section. */
  canDrag: boolean;
  dragging: boolean;
  onPress: () => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: (drop: boolean) => void;
};

/** A section's title down the side: tap it to choose who's in it, hold it to move it. */
function SectionTitle({
  title,
  canTap,
  canDrag,
  dragging,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
}: SectionTitleProps) {
  const theme = useTheme();
  const [offset] = useState(() => new Animated.Value(0));

  // Gesture-handler gestures, like the names below it, so the two don't compete.
  const pan = usePanGesture({
    enabled: canDrag,
    runOnJS: true,
    activateAfterLongPress: DRAG_DELAY_MS,
    onActivate: () => {
      offset.setValue(0);
      onDragStart();
    },
    onUpdate: (e) => {
      offset.setValue(e.translationY);
      onDragMove(e.translationY);
    },
    onDeactivate: (e) => {
      offset.setValue(0);
      onDragEnd(!e.canceled);
    },
  });
  const tap = useTapGesture({ enabled: canTap, runOnJS: true, onActivate: onPress });
  const gesture = useExclusiveGestures(pan, tap);

  const hint = [canTap && "Tap to choose who's in it.", canDrag && 'Hold to move.']
    .filter(Boolean)
    .join(' ');

  return (
    <GestureDetector gesture={gesture} userSelect="none">
      <Animated.View
        accessibilityRole={canTap ? 'button' : 'header'}
        accessibilityLabel={hint ? `${title}. ${hint}` : title}
        style={[
          styles.nameCell,
          styles.sectionCell,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          dragging && styles.dragging,
          dragging && { transform: [{ translateY: offset }] },
        ]}>
        {/* The section bar starts sky blue and fades across the grid. */}
        <LinearGradient
          colors={[theme.sky, theme.backgroundElement]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <ThemedText type="smallBold" numberOfLines={1} style={styles.nameText}>
          {title}
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

type Drag = { sectionId: string; from: number; to: number };
type SectionDrag = { from: number; to: number };

/** How far a name moves aside so the dragged one can drop into its place. */
function shiftFor(drag: Drag | null, sectionId: string, index: number) {
  if (!drag || drag.sectionId !== sectionId || index === drag.from) return 0;
  if (drag.from < drag.to && index > drag.from && index <= drag.to) return -ROW_HEIGHT;
  if (drag.from > drag.to && index >= drag.to && index < drag.from) return ROW_HEIGHT;
  return 0;
}

type BodyProps = {
  data: PageData;
  currentUserId: string | undefined;
  canEditLayout: boolean;
  onBodyScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onRowPress: (row: Row, section: Section) => void;
  onSectionPress: (section: Section) => void;
  /** New order of a section's rows, top to bottom. */
  onReorderRows: (rowIds: string[]) => void;
  /** New order of the page's sections, top to bottom. */
  onReorderSections: (sectionIds: string[]) => void;
  /** A name or section is being dragged, so the page shouldn't scroll. */
  onDragChange: (active: boolean) => void;
  onCellPress: (row: Row, column: Column, section: Section) => void;
  onCellLongPress: (row: Row, column: Column, section: Section) => void;
};

export function GridBody({
  data,
  currentUserId,
  canEditLayout,
  onBodyScroll,
  onRowPress,
  onSectionPress,
  onReorderRows,
  onReorderSections,
  onDragChange,
  onCellPress,
  onCellLongPress,
}: BodyProps) {
  const theme = useTheme();
  const today = new Date();
  const [drag, setDrag] = useState<Drag | null>(null);
  // The same drag, readable straight away inside gesture callbacks.
  const dragRef = useRef<Drag | null>(null);
  function updateDrag(next: Drag | null) {
    dragRef.current = next;
    setDrag(next);
  }
  // Fade the grid's right edge while there are more columns to scroll to.
  const [atEnd, setAtEnd] = useState(true);
  const widths = useRef({ view: 0, content: 0, x: 0 });
  function updateEdge() {
    const { view, content, x } = widths.current;
    const end = content <= view + 1 || x + view >= content - 2;
    setAtEnd((was) => (was === end ? was : end));
  }
  const [sectionDrag, setSectionDrag] = useState<SectionDrag | null>(null);
  const sectionDragRef = useRef<SectionDrag | null>(null);
  function updateSectionDrag(next: SectionDrag | null) {
    sectionDragRef.current = next;
    setSectionDrag(next);
  }

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

  // Where each section starts, top to bottom, to work out where a dragged
  // section would land. An empty section still shows its "No one yet" row.
  const sectionTops: number[] = [];
  let y = 0;
  for (const section of data.sections) {
    sectionTops.push(y);
    y += SECTION_HEIGHT + Math.max(1, rowsBySection.get(section.id)?.length ?? 0) * ROW_HEIGHT;
  }
  sectionTops.push(y);

  /** The new index for a section dragged `dy` from its place. */
  function sectionDropIndex(from: number, dy: number) {
    const centre = sectionTops[from] + SECTION_HEIGHT / 2 + dy;
    // The gap it's over: how many sections' middles are above it.
    let gap = 0;
    for (let i = 0; i < data.sections.length; i++) {
      if (sectionTops[i] + (sectionTops[i + 1] - sectionTops[i]) / 2 < centre) gap = i + 1;
    }
    return gap > from ? gap - 1 : gap;
  }

  // The line showing where a dragged section will drop.
  const dropLineTop =
    sectionDrag && sectionDrag.to !== sectionDrag.from
      ? sectionTops[sectionDrag.to > sectionDrag.from ? sectionDrag.to + 1 : sectionDrag.to]
      : null;

  const left: React.ReactNode[] = [];
  const right: React.ReactNode[] = [];

  data.sections.forEach((section, sectionIndex) => {
    const rows = rowsBySection.get(section.id) ?? [];

    left.push(
      <SectionTitle
        key={`s-${section.id}`}
        title={section.title}
        // Admins rename and choose people; others add or remove themselves.
        canTap={canEditLayout || section.auto_members}
        canDrag={canEditLayout && data.sections.length > 1}
        dragging={sectionDrag?.from === sectionIndex}
        onPress={() => onSectionPress(section)}
        onDragStart={() => {
          updateSectionDrag({ from: sectionIndex, to: sectionIndex });
          onDragChange(true);
        }}
        onDragMove={(dy) => {
          const current = sectionDragRef.current;
          const to = sectionDropIndex(sectionIndex, dy);
          if (current && current.to !== to) updateSectionDrag({ ...current, to });
        }}
        onDragEnd={(drop) => {
          const done = sectionDragRef.current;
          updateSectionDrag(null);
          onDragChange(false);
          if (drop && done && done.to !== done.from) {
            const ids = data.sections.map((s) => s.id);
            const [moved] = ids.splice(done.from, 1);
            ids.splice(done.to, 0, moved);
            onReorderSections(ids);
          }
        }}
      />,
    );
    right.push(
      <LinearGradient
        key={`s-${section.id}`}
        colors={[theme.backgroundElement, theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.sectionCell, line, { width: data.columns.length * width }]}
      />,
    );

    rows.forEach((row, index) => {
      left.push(
        <NameCell
          key={row.id}
          row={row}
          isMine={!!currentUserId && row.user_id === currentUserId}
          enabled={canEditLayout}
          dragging={drag?.sectionId === section.id && drag.from === index}
          shift={shiftFor(drag, section.id, index)}
          onPress={() => onRowPress(row, section)}
          onDragStart={() => {
            updateDrag({ sectionId: section.id, from: index, to: index });
            onDragChange(true);
          }}
          onDragMove={(dy) => {
            const current = dragRef.current;
            const to = Math.max(0, Math.min(rows.length - 1, index + Math.round(dy / ROW_HEIGHT)));
            if (current && current.to !== to) updateDrag({ ...current, to });
          }}
          onDragEnd={(drop) => {
            const done = dragRef.current;
            updateDrag(null);
            onDragChange(false);
            if (drop && done && done.to !== done.from) {
              const ids = rows.map((r) => r.id);
              const [moved] = ids.splice(done.from, 1);
              ids.splice(done.to, 0, moved);
              onReorderRows(ids);
            }
          }}
        />,
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
    });

    if (rows.length === 0) {
      left.push(
        <View key={`e-${section.id}`} style={[styles.nameCell, styles.rowCell, line]}>
          <ThemedText type="small" themeColor="textSecondary">
            No one yet
          </ThemedText>
        </View>,
      );
      right.push(<View key={`e-${section.id}`} style={[styles.rowCell, line, { width: data.columns.length * width }]} />);
    }
  });

  return (
    <View style={styles.body}>
      <View style={[styles.nameColumn, { borderColor: theme.border }]}>
        {left.map((node, i) => (
          <Fragment key={i}>{node}</Fragment>
        ))}
      </View>
      <ScrollView
        horizontal
        onScroll={(e) => {
          onBodyScroll(e);
          widths.current.x = e.nativeEvent.contentOffset.x;
          updateEdge();
        }}
        onLayout={(e) => {
          widths.current.view = e.nativeEvent.layout.width;
          updateEdge();
        }}
        onContentSizeChange={(contentWidth) => {
          widths.current.content = contentWidth;
          updateEdge();
        }}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}>
        <View>
          {right.map((node, i) => (
            <Fragment key={i}>{node}</Fragment>
          ))}
        </View>
      </ScrollView>
      {!atEnd && (
        <LinearGradient
          colors={[`${theme.background}00`, theme.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.edgeFade}
          pointerEvents="none"
        />
      )}
      {dropLineTop !== null && (
        <View
          pointerEvents="none"
          style={[styles.dropLine, { top: dropLineTop - 1.5, backgroundColor: theme.tint }]}
        />
      )}
    </View>
  );
}

/** The colour key, e.g. "Y Prefer · N Not available". */
export function Legend({ options, onPress }: { options: Option[]; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress
          ? `Choices: ${options.map((o) => `${o.value} ${o.label}`).join(', ')}. Tap to edit.`
          : undefined
      }
      onPress={onPress}
      style={({ pressed }) => [styles.legend, pressed && styles.pressed]}>
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
      {onPress && (
        <ThemedText type="small" style={{ color: theme.link, fontWeight: 600 }}>
          Edit
        </ThemedText>
      )}
    </Pressable>
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
    // Keeps today's glow inside the rounded corners.
    overflow: 'hidden',
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
  edgeFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 32,
  },
  dropLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
    zIndex: 2,
  },
  dragging: {
    zIndex: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pressed: {
    opacity: 0.6,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
