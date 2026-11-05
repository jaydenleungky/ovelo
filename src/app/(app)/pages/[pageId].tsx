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

import { AddSectionSheet } from '@/components/add-section-sheet';
import { Button } from '@/components/button';
import { CellEditor, type CellTarget } from '@/components/cell-editor';
import { GridBody, GridHeader, Legend, gridWidth, useGridScrollSync } from '@/components/page-grid';
import { RenameSheet } from '@/components/rename-sheet';
import { SectionSheet } from '@/components/section-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { confirmAction, showMessage } from '@/lib/dialogs';
import { getMyRole, listMembers, type Member, type Role } from '@/lib/groups';
import { subscribeToPage, type PageChange } from '@/lib/page-live';
import {
  addSection,
  deletePage,
  deleteSection,
  getPageData,
  removeRow,
  renamePage,
  renameRow,
  renameSection,
  reorderRows,
  reorderSections,
  setCell,
  setPageEveryone,
  setSectionMember,
  type Column,
  type PageData,
  type Row,
  type Section,
} from '@/lib/pages';

const COLUMN_WORD = { weekdays: 'day', dates: 'date', custom: 'column' } as const;
const SHORT_SCREEN_HEIGHT = 500;
const MAX_TITLE_LENGTH = 60;
const MAX_NAME_LENGTH = 40;

/** What the rename sheet is open for. */
type Renaming = { kind: 'page' } | { kind: 'row'; row: Row; section: Section };

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
    case 'page':
      return { ...data, page: { ...data.page, ...change.page } };
    case 'section': {
      const others = data.sections.filter((s) => s.id !== change.section.id);
      const sections = [...others, change.section].sort((a, b) => a.position - b.position);
      return { ...data, sections };
    }
    case 'section-removed': {
      // Deletes arrive for every page, so skip sections that aren't on this one.
      if (!data.sections.some((s) => s.id === change.sectionId)) return data;
      const gone = new Set(data.rows.filter((r) => r.section_id === change.sectionId).map((r) => r.id));
      return {
        ...data,
        sections: data.sections.filter((s) => s.id !== change.sectionId),
        rows: data.rows.filter((r) => !gone.has(r.id)),
        cells: data.cells.filter((c) => !gone.has(c.row_id)),
      };
    }
  }
}

/** The page with its sections put in a new order. */
function withSectionOrder(data: PageData, sectionIds: string[]): PageData {
  const positions = new Map(sectionIds.map((id, position) => [id, position]));
  const sections = data.sections
    .map((s) => ({ ...s, position: positions.get(s.id) ?? s.position }))
    .sort((a, b) => a.position - b.position);
  return { ...data, sections };
}

/** The page with a section's rows put in a new order. */
function withRowOrder(data: PageData, rowIds: string[]): PageData {
  const positions = new Map(rowIds.map((id, position) => [id, position]));
  const rows = data.rows
    .map((r) => (positions.has(r.id) ? { ...r, position: positions.get(r.id)! } : r))
    .sort((a, b) => a.position - b.position);
  return { ...data, rows };
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
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  // null = not toggled yet: start open, except on short (landscape) screens
  // where the card would push the grid out of view.
  const [instructionsToggled, setInstructionsToggled] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<CellTarget | null>(null);
  const [renaming, setRenaming] = useState<Renaming | null>(null);
  // The section whose sheet is open (by id, so live renames show in it).
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  // "sectionId:userId" for section changes still saving.
  const [savingMembers, setSavingMembers] = useState<Set<string>>(new Set());
  // Off while a name is being dragged, so the page stays still.
  const [scrollEnabled, setScrollEnabled] = useState(true);
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
            const [myRole, groupMembers] = await Promise.all([
              getMyRole(result.page.group_id, userId!),
              listMembers(result.page.group_id),
            ]);
            if (!active) return;
            setMembers(groupMembers);
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

  /** Shows a layout change straight away; reloads the page if saving fails. */
  async function saveLayout(change: (d: PageData) => PageData, save: () => Promise<void>) {
    setData((d) => d && change(d));
    try {
      await save();
    } catch (e) {
      showMessage("Couldn't save that change", e instanceof Error ? e.message : undefined);
      getPageData(pageId).then(setData).catch(() => {});
    }
  }

  function handleRename(value: string) {
    if (!renaming) return;
    if (renaming.kind === 'page') {
      saveLayout(
        (d) => ({ ...d, page: { ...d.page, title: value } }),
        () => renamePage(pageId, value),
      );
    } else {
      const { id } = renaming.row;
      saveLayout(
        (d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, label: value } : r)) }),
        () => renameRow(id, value),
      );
    }
  }

  async function confirmRemoveRow(row: Row, section: Section) {
    setRenaming(null);
    const confirmed = await confirmAction({
      title: `Remove ${row.label} from ${section.title}?`,
      message: `Anything filled in on their row will be lost.${
        row.user_id ? ' You can add them back by tapping the section’s title.' : ''
      }`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    saveLayout(
      (d) => withChange(d, { kind: 'row-removed', rowId: row.id }),
      () => removeRow(row.id),
    );
  }

  function handleRenameSection(sectionId: string, title: string) {
    saveLayout(
      (d) => ({
        ...d,
        sections: d.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
      }),
      () => renameSection(sectionId, title),
    );
  }

  async function handleAddSection(title: string, cellType: Section['cell_type']) {
    if (!data) return;
    const position = data.sections.reduce((max, s) => Math.max(max, s.position + 1), 0);
    try {
      await addSection(pageId, position, title, cellType);
      // The section (and, on "everyone" pages, its people) also arrive live.
      setData(await getPageData(pageId));
    } catch (e) {
      showMessage("Couldn't add the section", e instanceof Error ? e.message : undefined);
    }
  }

  function handleReorderSections(sectionIds: string[]) {
    saveLayout(
      (d) => withSectionOrder(d, sectionIds),
      () => reorderSections(sectionIds),
    );
  }

  async function confirmDeleteSection(section: Section) {
    const confirmed = await confirmAction({
      title: `Delete ${section.title}?`,
      message: 'Everyone’s rows in this section, and everything filled in on them, will be lost.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    setOpenSectionId(null);
    saveLayout(
      (d) => withChange(d, { kind: 'section-removed', sectionId: section.id }),
      () => deleteSection(section.id),
    );
  }

  /** Ticks someone in or out of a section. The new row arrives as a live update. */
  async function toggleSectionMember(section: Section, member: Member, inSection: boolean) {
    if (!inSection) {
      const row = data?.rows.find((r) => r.section_id === section.id && r.user_id === member.user_id);
      const hasEntries = !!row && !!data?.cells.some((c) => c.row_id === row.id);
      if (hasEntries) {
        const isMe = member.user_id === userId;
        const confirmed = await confirmAction({
          title: `Take ${isMe ? 'yourself' : member.display_name} out of ${section.title}?`,
          message: `Anything filled in on ${isMe ? 'your' : 'their'} row will be lost.`,
          confirmText: 'Take out',
          destructive: true,
        });
        if (!confirmed) return;
      }
    }

    const key = `${section.id}:${member.user_id}`;
    setSavingMembers((s) => new Set(s).add(key));
    try {
      await setSectionMember(section.id, member.user_id, inSection);
      // Don't wait on the live update to show the change.
      const fresh = await getPageData(pageId);
      setData(fresh);
    } catch (e) {
      showMessage("Couldn't save that change", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingMembers((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  async function toggleEveryone(everyone: boolean) {
    if (!data) return;
    if (everyone) {
      const confirmed = await confirmAction({
        title: 'Put everyone in every section?',
        message: 'Anyone missing from a section will be added to it, now and when they join.',
        confirmText: 'Add everyone',
      });
      if (!confirmed) return;
    }
    await saveLayout(
      (d) => ({ ...d, page: { ...d.page, auto_members: everyone } }),
      () => setPageEveryone(data.page.id, everyone),
    );
    // New rows come in as live updates; reload in case they're slow.
    if (everyone) getPageData(pageId).then(setData).catch(() => {});
  }

  function handleReorder(rowIds: string[]) {
    saveLayout(
      (d) => withRowOrder(d, rowIds),
      () => reorderRows(rowIds),
    );
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
  const openSection = data.sections.find((s) => s.id === openSectionId);
  const showInstructions = instructionsToggled ?? screen.height >= SHORT_SCREEN_HEIGHT;
  const overflows = gridWidth(data) > screen.width;
  const showRotateTip = overflows && Platform.OS !== 'web' && screen.height > screen.width;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: data.page.title,
          headerTitle: isAdmin
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${data.page.title}. Tap to rename.`}
                  hitSlop={8}
                  onPress={() => setRenaming({ kind: 'page' })}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {data.page.title}
                  </ThemedText>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        scrollEnabled={scrollEnabled}
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
            <Legend options={data.options} />
          )}
          {!data.page.auto_members && (
            <ThemedText type="small" themeColor="textSecondary">
              Tap a section’s title to add yourself to it
              {isAdmin ? ', or to choose who’s in it' : ''}.
            </ThemedText>
          )}
          {data.page.auto_members && !hasRows && (
            <ThemedText type="small" themeColor="textSecondary">
              Everyone in the group is added here automatically, including people who join later.
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
          onRowPress={(row, section) => setRenaming({ kind: 'row', row, section })}
          onSectionPress={(section) => setOpenSectionId(section.id)}
          onReorderRows={handleReorder}
          onReorderSections={handleReorderSections}
          onDragChange={(active) => setScrollEnabled(!active)}
          onCellPress={handleCellPress}
          onCellLongPress={handleCellLongPress}
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
            {isAdmin
              ? '\nTap a section’s title or a name to edit it. Hold either one, then slide up or down to move it.'
              : ''}
          </ThemedText>
          {isAdmin && (
            <Button
              title="Add a section"
              variant="secondary"
              onPress={() => setAddingSection(true)}
            />
          )}
          {isAdmin && (
            <ThemedView type="backgroundElement" style={styles.switchRow}>
              <View style={styles.switchText}>
                <ThemedText type="smallBold">Everyone in every section</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {data.page.auto_members
                    ? 'Everyone in the group has a row in each section.'
                    : 'People choose which sections they’re in.'}
                </ThemedText>
              </View>
              <Switch
                value={data.page.auto_members}
                onValueChange={toggleEveryone}
                accessibilityLabel="Everyone in every section"
              />
            </ThemedView>
          )}
          {isAdmin && <Button title="Delete page" variant="secondary" onPress={confirmDelete} />}
        </View>
      </ScrollView>

      {renaming && (
        <RenameSheet
          key={renaming.kind === 'page' ? 'page' : renaming.row.id}
          heading={renaming.kind === 'page' ? 'Page name' : `Name in ${renaming.section.title}`}
          note={
            renaming.kind === 'row' && renaming.row.user_id
              ? 'On Ovelo · renaming only changes how they appear on this page.'
              : undefined
          }
          value={renaming.kind === 'page' ? data.page.title : renaming.row.label}
          maxLength={renaming.kind === 'row' ? MAX_NAME_LENGTH : MAX_TITLE_LENGTH}
          onSave={handleRename}
          onClose={() => setRenaming(null)}
          removeLabel={renaming.kind === 'row' ? `Remove from ${renaming.section.title}` : undefined}
          onRemove={
            renaming.kind === 'row'
              ? () => confirmRemoveRow(renaming.row, renaming.section)
              : undefined
          }
        />
      )}

      {openSection && (
        <SectionSheet
          key={openSection.id}
          title={openSection.title}
          canRename={isAdmin}
          holdsPeople={openSection.auto_members}
          people={members.map((m) => ({
            userId: m.user_id,
            name: m.user_id === userId ? `${m.display_name} (you)` : m.display_name,
            inSection: data.rows.some(
              (r) => r.section_id === openSection.id && r.user_id === m.user_id,
            ),
            canToggle: isAdmin || m.user_id === userId,
            busy: savingMembers.has(`${openSection.id}:${m.user_id}`),
          }))}
          onToggle={(memberId, inSection) => {
            const member = members.find((m) => m.user_id === memberId);
            if (member) toggleSectionMember(openSection, member, inSection);
          }}
          onRename={(title) => handleRenameSection(openSection.id, title)}
          onClose={() => setOpenSectionId(null)}
          onDelete={
            isAdmin && data.sections.length > 1
              ? () => confirmDeleteSection(openSection)
              : undefined
          }
        />
      )}

      {addingSection && (
        <AddSectionSheet
          existingTitles={data.sections.map((s) => s.title)}
          hasChoices={data.options.length > 0}
          onAdd={handleAddSection}
          onClose={() => setAddingSection(false)}
        />
      )}

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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  switchText: {
    flex: 1,
  },
});
