import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { CellEditor, type CellTarget } from '@/components/cell-editor';
import { GridBody, GridHeader, Legend, gridWidth, useGridScrollSync } from '@/components/page-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { confirmAction, showMessage } from '@/lib/dialogs';
import { getMyRole, type Role } from '@/lib/groups';
import { subscribeToPage, type PageChange } from '@/lib/page-live';
import {
  deletePage,
  getPageData,
  setCell,
  setPageTrackDone,
  setRowsDone,
  type Column,
  type PageData,
  type Row,
  type Section,
} from '@/lib/pages';

const COLUMN_WORD = { weekdays: 'day', dates: 'date', custom: 'column' } as const;
const SHORT_SCREEN_HEIGHT = 500;

/** The page with one live change from someone else applied. */
function withChange(data: PageData, change: PageChange): PageData {
  switch (change.kind) {
    case 'cell': {
      const { rowId, columnId, value } = change;
      // Deletes arrive for every page, so skip rows that aren't on this one.
      if (!data.rows.some((r) => r.id === rowId)) return data;
      const others = data.cells.filter((c) => !(c.row_id === rowId && c.column_id === columnId));
      return {
        ...data,
        cells: value ? [...others, { row_id: rowId, column_id: columnId, value }] : others,
      };
    }
    case 'row': {
      const others = data.rows.filter((r) => r.id !== change.row.id);
      const rows = [...others, change.row].sort((a, b) => a.position - b.position);
      return { ...data, rows };
    }
    case 'row-removed':
      if (!data.rows.some((r) => r.id === change.rowId)) return data;
      return {
        ...data,
        rows: data.rows.filter((r) => r.id !== change.rowId),
        cells: data.cells.filter((c) => c.row_id !== change.rowId),
      };
  }
}

export default function PageScreen() {
  const theme = useTheme();
  const { pageId } = useLocalSearchParams<{ pageId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { headerRef, onBodyScroll } = useGridScrollSync();
  const screen = useWindowDimensions();

  const [data, setData] = useState<PageData | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = not toggled yet: start open, except on short (landscape) screens
  // where the card would push the grid out of view.
  const [instructionsToggled, setInstructionsToggled] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<CellTarget | null>(null);
  // Saves for the same cell run one after another, so quick taps land in order.
  const pendingSaves = useRef(new Map<string, Promise<void>>());
  // Values this device has saved per cell but not yet heard back about.
  // Live updates for them are our own saves echoing back, so they're skipped.
  const unconfirmed = useRef(new Map<string, string[]>());

  // While the page is in view: load it, and keep it up to date as others edit.
  // Coming back into view (e.g. after adding people) loads it again.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;

      function load() {
        getPageData(pageId)
          .then(async (result) => {
            const myRole = await getMyRole(result.page.group_id, userId!);
            if (!active) return;
            setData(result);
            setRole(myRole);
            setError(null);
          })
          .catch((e: Error) => active && setError(e.message));
      }

      function isOwnEcho(key: string, value: string) {
        const waiting = unconfirmed.current.get(key);
        const index = waiting?.indexOf(value) ?? -1;
        if (!waiting || index === -1) return false;
        waiting.splice(0, index + 1);
        // If newer saves are still on their way, keep showing those.
        if (waiting.length > 0) return true;
        unconfirmed.current.delete(key);
        return false;
      }

      function applyChange(change: PageChange) {
        if (change.kind === 'cell') {
          const key = `${change.rowId}:${change.columnId}`;
          if (isOwnEcho(key, change.value)) return;
        }
        setData((d) => (d ? withChange(d, change) : d));
      }

      load();
      // Also reloads on every (re)connect, to catch up on anything missed
      // while the phone was asleep or offline.
      const unsubscribe = subscribeToPage(pageId, applyChange, load);
      return () => {
        active = false;
        unsubscribe();
      };
    }, [pageId, userId]),
  );

  const isAdmin = role === 'admin';

  /** Your own rows, rows not linked to anyone, or any row if you're an admin. */
  function canEditRow(row: Row) {
    return isAdmin || row.user_id === null || row.user_id === userId;
  }

  function explainLocked(row: Row) {
    showMessage(
      "You can't change this row",
      `Only ${row.label} or a group admin can fill in ${row.label}'s row.`,
    );
  }

  function cellValue(rowId: string, columnId: string) {
    return data?.cells.find((c) => c.row_id === rowId && c.column_id === columnId)?.value ?? '';
  }

  function showCellLocally(rowId: string, columnId: string, value: string) {
    setData((d) => {
      if (!d) return d;
      const others = d.cells.filter((c) => !(c.row_id === rowId && c.column_id === columnId));
      return {
        ...d,
        cells: value ? [...others, { row_id: rowId, column_id: columnId, value }] : others,
      };
    });
  }

  /** Shows the new value straight away, saves in the background, undoes on failure. */
  function saveCell(rowId: string, columnId: string, value: string) {
    if (!data) return;
    const previous = cellValue(rowId, columnId);
    if (previous === value) return;
    showCellLocally(rowId, columnId, value);

    const key = `${rowId}:${columnId}`;
    const waiting = unconfirmed.current.get(key) ?? [];
    unconfirmed.current.set(key, [...waiting, value]);

    const before = pendingSaves.current.get(key) ?? Promise.resolve();
    const save = before
      .then(() => setCell(data.page.id, rowId, columnId, value))
      .catch((e: Error) => {
        // No echo is coming for a save that failed.
        const list = unconfirmed.current.get(key);
        list?.splice(list.indexOf(value), 1);
        showCellLocally(rowId, columnId, previous);
        showMessage("Couldn't save that change", e.message);
      });
    pendingSaves.current.set(key, save);
  }

  function openEditor(row: Row, column: Column, section: Section) {
    setEditing({
      rowId: row.id,
      columnId: column.id,
      rowLabel: row.label,
      columnLabel: column.label,
      cellType: section.cell_type,
      value: cellValue(row.id, column.id),
    });
  }

  // Tap: choice cells step through blank → each choice → blank; text cells open the editor.
  function handleCellPress(row: Row, column: Column, section: Section) {
    if (!data) return;
    if (!canEditRow(row)) return explainLocked(row);
    if (section.cell_type === 'text') return openEditor(row, column, section);
    if (data.options.length === 0) return;

    const cycle = ['', ...data.options.map((o) => o.value)];
    const index = cycle.indexOf(cellValue(row.id, column.id));
    saveCell(row.id, column.id, cycle[(index + 1) % cycle.length]);
  }

  // Hold: open the editor to pick any choice or clear the cell.
  function handleCellLongPress(row: Row, column: Column, section: Section) {
    if (!canEditRow(row)) return explainLocked(row);
    openEditor(row, column, section);
  }

  async function toggleTrackDone(trackDone: boolean) {
    if (!data) return;
    const setLocal = (value: boolean) =>
      setData((d) => d && { ...d, page: { ...d.page, track_done: value } });
    setLocal(trackDone);
    try {
      await setPageTrackDone(data.page.id, trackDone);
    } catch (e) {
      setLocal(!trackDone);
      showMessage("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  }

  async function toggleDone(rowIds: string[], isDone: boolean) {
    const setDone = (done: boolean) =>
      setData((d) =>
        d && {
          ...d,
          rows: d.rows.map((r) => (rowIds.includes(r.id) ? { ...r, is_done: done } : r)),
        },
      );
    setDone(isDone);
    try {
      await setRowsDone(rowIds, isDone);
    } catch (e) {
      setDone(!isDone);
      showMessage("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  }

  async function confirmDelete() {
    if (!data) return;
    const confirmed = await confirmAction({
      title: `Delete "${data.page.title}"?`,
      message: 'Everything filled in on this page will be lost.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deletePage(data.page.id);
      router.back();
    } catch (e) {
      showMessage('Could not delete', e instanceof Error ? e.message : undefined);
    }
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  if (!data) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const hasRows = data.rows.length > 0;
  const showInstructions = instructionsToggled ?? screen.height >= SHORT_SCREEN_HEIGHT;
  const overflows = gridWidth(data) > screen.width;
  const showRotateTip = overflows && Platform.OS !== 'web' && screen.height > screen.width;
  const myRowIds = data.rows.filter((r) => r.user_id === userId).map((r) => r.id);
  const iAmDone = myRowIds.length > 0 && data.rows.every((r) => r.user_id !== userId || r.is_done);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: data.page.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.scroll}>
        {/* 0: intro (scrolls away) */}
        <View style={styles.intro}>
          {data.page.instructions !== '' && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showInstructions }}
              onPress={() => setInstructionsToggled(!showInstructions)}>
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText type="smallBold">How to fill this in</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {showInstructions ? 'Hide' : 'Show'}
                  </ThemedText>
                </View>
                {showInstructions && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {data.page.instructions}
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>
          )}
          {data.options.length > 0 && (
            <Legend
              options={data.options}
              blankLabel={data.page.template === 'roster' ? 'Available' : undefined}
            />
          )}
          {data.page.track_done && myRowIds.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.doneRow}>
              <ThemedText type="small" style={styles.doneText}>
                {iAmDone
                  ? '✓ You’ve marked yourself as done.'
                  : 'Finished filling in your rows? Let everyone know.'}
              </ThemedText>
              <Button
                title={iAmDone ? 'Undo' : 'I’m done'}
                variant={iAmDone ? 'secondary' : 'primary'}
                onPress={() => toggleDone(myRowIds, !iAmDone)}
              />
            </ThemedView>
          )}
          {!hasRows && isAdmin && (
            <ThemedText type="small" themeColor="textSecondary">
              Tap “+ Add person” under each section to add your team.
            </ThemedText>
          )}
        </View>

        {/* 1: sticky header */}
        <GridHeader data={data} headerRef={headerRef} />

        {/* 2: grid */}
        <GridBody
          data={data}
          currentUserId={userId}
          canEditLayout={isAdmin}
          onBodyScroll={onBodyScroll}
          onCellPress={handleCellPress}
          onCellLongPress={handleCellLongPress}
          onAddRow={(sectionId, sectionTitle) =>
            router.push({
              pathname: '/pages/add-row',
              params: {
                pageId: data.page.id,
                groupId: data.page.group_id,
                sectionId,
                sectionTitle,
              },
            })
          }
        />

        {/* 3: footer */}
        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {overflows
              ? `Scroll sideways to see every ${COLUMN_WORD[data.page.column_mode]}.`
              : ''}
            {showRotateTip ? ' Or turn your phone sideways to see more at once.' : ''}
            {overflows ? '\n' : ''}
            {data.options.length > 0
              ? 'Tap a cell to change it, or hold it to see every choice.'
              : 'Tap a cell to fill it in.'}
          </ThemedText>
          {isAdmin && (
            <ThemedView type="backgroundElement" style={styles.doneRow}>
              <View style={styles.doneText}>
                <ThemedText type="smallBold">“I’m done” button</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Let people tick themselves off once they’ve filled in their rows.
                </ThemedText>
              </View>
              <Switch
                value={data.page.track_done}
                onValueChange={toggleTrackDone}
                accessibilityLabel="I'm done button"
              />
            </ThemedView>
          )}
          {isAdmin && <Button title="Delete page" variant="secondary" onPress={confirmDelete} />}
        </View>
      </ScrollView>

      {editing && (
        <CellEditor
          key={`${editing.rowId}:${editing.columnId}`}
          target={editing}
          options={data.options}
          onSave={(value) => saveCell(editing.rowId, editing.columnId, value)}
          onClose={() => setEditing(null)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  scroll: {
    paddingBottom: Spacing.six,
  },
  intro: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  hint: {
    textAlign: 'center',
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  doneText: {
    flex: 1,
  },
});
