import { listMembers } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import type { CellType, ColumnMode, TemplateSpec } from '@/lib/templates';

export type PageSummary = {
  id: string;
  title: string;
  template: TemplateSpec['template'];
  column_mode: ColumnMode;
  created_at: string;
};

export type Page = PageSummary & { group_id: string; instructions: string; track_done: boolean };
export type Column = { id: string; position: number; label: string; date: string | null };
export type Option = { id: string; position: number; value: string; label: string; colour: string };
export type Section = {
  id: string;
  position: number;
  title: string;
  cell_type: CellType;
  notify: boolean;
};
export type Row = {
  id: string;
  section_id: string;
  position: number;
  label: string;
  user_id: string | null;
  is_done: boolean;
};
export type Cell = { row_id: string; column_id: string; value: string };

export type PageData = {
  page: Page;
  columns: Column[];
  options: Option[];
  sections: Section[];
  rows: Row[];
  cells: Cell[];
};

function check<T>({ data, error }: { data: T | null; error: Error | null }): T {
  if (error) throw error;
  return data as T;
}

export async function listPages(groupId: string): Promise<PageSummary[]> {
  return check(
    await supabase
      .from('pages')
      .select('id, title, template, column_mode, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .overrideTypes<PageSummary[], { merge: false }>(),
  );
}

/** Everything needed to draw one page's grid. */
export async function getPageData(pageId: string): Promise<PageData> {
  const byPage = <T>(table: string, columns: string, orderBy?: string) => {
    const query = supabase.from(table).select(columns).eq('page_id', pageId);
    return (orderBy ? query.order(orderBy) : query).overrideTypes<T[], { merge: false }>();
  };

  const [page, columns, options, sections, rows, cells] = await Promise.all([
    supabase
      .from('pages')
      .select('id, group_id, title, instructions, template, column_mode, track_done, created_at')
      .eq('id', pageId)
      .single<Page>(),
    byPage<Column>('page_columns', 'id, position, label, date', 'position'),
    byPage<Option>('page_options', 'id, position, value, label, colour', 'position'),
    byPage<Section>('page_sections', 'id, position, title, cell_type, notify', 'position'),
    byPage<Row>('page_rows', 'id, section_id, position, label, user_id, is_done', 'position'),
    byPage<Cell>('cells', 'row_id, column_id, value'),
  ]);

  return {
    page: check(page),
    columns: check(columns),
    options: check(options),
    sections: check(sections),
    rows: check(rows),
    cells: check(cells),
  };
}

/**
 * Creates a page and its columns, legend, sections and rows from a template.
 * If any step fails the half-made page is deleted.
 */
export async function createPageFromTemplate(
  groupId: string,
  title: string,
  spec: TemplateSpec,
): Promise<string> {
  const page = check(
    await supabase
      .from('pages')
      .insert({
        group_id: groupId,
        title,
        instructions: spec.instructions,
        template: spec.template,
        column_mode: spec.columnMode,
        track_done: spec.trackDone,
      })
      .select('id')
      .single<{ id: string }>(),
  );

  try {
    const needsMembers = spec.sections.some((s) => s.rows === 'members');
    const [members, , , sections] = await Promise.all([
      needsMembers ? listMembers(groupId) : Promise.resolve([]),
      supabase
        .from('page_columns')
        .insert(spec.columns.map((c, position) => ({ page_id: page.id, position, ...c })))
        .then(check),
      spec.options.length > 0
        ? supabase
            .from('page_options')
            .insert(spec.options.map((o, position) => ({ page_id: page.id, position, ...o })))
            .then(check)
        : Promise.resolve(),
      supabase
        .from('page_sections')
        .insert(
          spec.sections.map((s, position) => ({
            page_id: page.id,
            position,
            title: s.title,
            cell_type: s.cellType,
            notify: s.notify,
          })),
        )
        .select('id, position')
        .overrideTypes<{ id: string; position: number }[], { merge: false }>()
        .then(check),
    ]);

    const sectionIds = new Map(sections.map((s) => [s.position, s.id]));
    const rows = spec.sections.flatMap((section, sectionPosition) => {
      const entries =
        section.rows === 'members'
          ? members.map((m) => ({ label: m.display_name, user_id: m.user_id }))
          : section.rows.map((label) => ({ label, user_id: null }));
      return entries.map((entry, position) => ({
        page_id: page.id,
        section_id: sectionIds.get(sectionPosition),
        position,
        ...entry,
      }));
    });
    if (rows.length > 0) {
      check(await supabase.from('page_rows').insert(rows));
    }
  } catch (e) {
    await supabase.from('pages').delete().eq('id', page.id);
    throw e;
  }

  return page.id;
}

/** Rows already in a section, e.g. to avoid adding someone twice. */
export async function listSectionRows(sectionId: string): Promise<Row[]> {
  return check(
    await supabase
      .from('page_rows')
      .select('id, section_id, position, label, user_id, is_done')
      .eq('section_id', sectionId)
      .order('position')
      .overrideTypes<Row[], { merge: false }>(),
  );
}

/** Adds rows to the end of a section, in order. */
export async function addRows(
  pageId: string,
  sectionId: string,
  entries: { label: string; user_id: string | null }[],
) {
  const existing = await listSectionRows(sectionId);
  const start = existing.reduce((max, r) => Math.max(max, r.position + 1), 0);
  check(
    await supabase.from('page_rows').insert(
      entries.map((entry, i) => ({
        page_id: pageId,
        section_id: sectionId,
        position: start + i,
        ...entry,
      })),
    ),
  );
}

export async function deletePage(pageId: string) {
  check(await supabase.from('pages').delete().eq('id', pageId));
}

/** Saves one cell. An empty value clears it. */
export async function setCell(pageId: string, rowId: string, columnId: string, value: string) {
  if (value === '') {
    check(await supabase.from('cells').delete().eq('row_id', rowId).eq('column_id', columnId));
    return;
  }
  check(
    await supabase
      .from('cells')
      .upsert(
        { page_id: pageId, row_id: rowId, column_id: columnId, value },
        { onConflict: 'row_id,column_id' },
      ),
  );
}

/** Marks rows as done (or not), e.g. "I've filled in my availability". */
export async function setRowsDone(rowIds: string[], isDone: boolean) {
  check(await supabase.from('page_rows').update({ is_done: isDone }).in('id', rowIds));
}

/** Turns the page's "I'm done" button on or off. Admins only. */
export async function setPageTrackDone(pageId: string, trackDone: boolean) {
  check(await supabase.from('pages').update({ track_done: trackDone }).eq('id', pageId));
}
