import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import type { Cell, Page, Row, Section } from '@/lib/pages';
import { supabase } from '@/lib/supabase';

export type PageChange =
  | { kind: 'cell'; rowId: string; columnId: string; value: string }
  | { kind: 'row'; row: Row }
  | { kind: 'row-removed'; rowId: string }
  | { kind: 'page'; page: Pick<Page, 'title' | 'instructions' | 'auto_members'> }
  | { kind: 'section'; section: Section }
  | { kind: 'section-removed'; sectionId: string };

type CellRecord = Cell & { page_id: string };
type RowRecord = Row & { page_id: string };
type PageRecord = Page;
type SectionRecord = Section & { page_id: string };

function toRow(r: RowRecord): Row {
  return {
    id: r.id,
    section_id: r.section_id,
    position: r.position,
    label: r.label,
    user_id: r.user_id,
  };
}

/**
 * Listens for other people's changes to a page: its name and settings,
 * sections, rows and cells.
 *
 * `onConnected` runs each time the connection is (re)made, e.g. after the
 * phone wakes up, so the caller can reload anything it missed meanwhile.
 * Returns a function that stops listening.
 */
export function subscribeToPage(
  pageId: string,
  onChange: (change: PageChange) => void,
  onConnected: () => void,
) {
  const onPage = `page_id=eq.${pageId}`;

  const cellChanged = (payload: RealtimePostgresChangesPayload<CellRecord>) => {
    if (payload.eventType === 'DELETE') {
      // Deletes only carry the key and can't be filtered by page, so they may
      // belong to another page. The caller ignores rows it doesn't have.
      const { row_id, column_id } = payload.old;
      if (row_id && column_id)
        onChange({
          kind: 'cell',
          rowId: row_id,
          columnId: column_id,
          value: '',
        });
      return;
    }
    const { row_id, column_id, value } = payload.new;
    onChange({ kind: 'cell', rowId: row_id, columnId: column_id, value });
  };

  const rowChanged = (payload: RealtimePostgresChangesPayload<RowRecord>) => {
    if (payload.eventType === 'DELETE') {
      if (payload.old.id) onChange({ kind: 'row-removed', rowId: payload.old.id });
      return;
    }
    onChange({ kind: 'row', row: toRow(payload.new) });
  };

  const pageChanged = (payload: RealtimePostgresChangesPayload<PageRecord>) => {
    if (payload.eventType !== 'UPDATE') return;
    const { title, instructions, auto_members } = payload.new;
    onChange({ kind: 'page', page: { title, instructions, auto_members } });
  };

  const sectionChanged = (payload: RealtimePostgresChangesPayload<SectionRecord>) => {
    if (payload.eventType === 'DELETE') {
      if (payload.old.id) onChange({ kind: 'section-removed', sectionId: payload.old.id });
      return;
    }
    const { id, position, title, cell_type, notify, auto_members } = payload.new;
    onChange({ kind: 'section', section: { id, position, title, cell_type, notify, auto_members } });
  };

  const channel = supabase
    .channel(`page:${pageId}`)
    .on<CellRecord>(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cells', filter: onPage },
      cellChanged,
    )
    .on<CellRecord>(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cells', filter: onPage },
      cellChanged,
    )
    .on<CellRecord>(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'cells' },
      cellChanged,
    )
    .on<RowRecord>(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'page_rows', filter: onPage },
      rowChanged,
    )
    .on<RowRecord>(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'page_rows', filter: onPage },
      rowChanged,
    )
    .on<RowRecord>(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'page_rows' },
      rowChanged,
    )
    .on<PageRecord>(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'pages', filter: `id=eq.${pageId}` },
      pageChanged,
    )
    .on<SectionRecord>(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'page_sections', filter: onPage },
      sectionChanged,
    )
    .on<SectionRecord>(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'page_sections', filter: onPage },
      sectionChanged,
    )
    .on<SectionRecord>(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'page_sections' },
      sectionChanged,
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onConnected();
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
