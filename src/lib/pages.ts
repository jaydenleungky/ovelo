import { supabase } from '@/lib/supabase';
import type { CellType, ColumnMode, TemplateSpec } from '@/lib/templates';

export type PageSummary = {
  id: string;
  title: string;
  template: TemplateSpec['template'];
  column_mode: ColumnMode;
  created_at: string;
};

export type Page = PageSummary & {
  group_id: string;
  instructions: string;
  /** Everyone in the group is in every section. */
  auto_members: boolean;
};
export type Column = { id: string; position: number; label: string; date: string | null };
export type Option = { id: string; position: number; value: string; label: string; colour: string };
export type Section = {
  id: string;
  position: number;
  title: string;
  cell_type: CellType;
  notify: boolean;
  /** Holds people, rather than fixed rows like the shared "Car" row. */
  auto_members: boolean;
};
export type Row = {
  id: string;
  section_id: string;
  position: number;
  label: string;
  user_id: string | null;
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
      .select(
        'id, group_id, title, instructions, template, column_mode, auto_members, created_at',
      )
      .eq('id', pageId)
      .single<Page>(),
    byPage<Column>('page_columns', 'id, position, label, date', 'position'),
    byPage<Option>('page_options', 'id, position, value, label, colour', 'position'),
    byPage<Section>(
      'page_sections',
      'id, position, title, cell_type, notify, auto_members',
      'position',
    ),
    byPage<Row>('page_rows', 'id, section_id, position, label, user_id', 'position'),
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
        auto_members: spec.everyone,
      })
      .select('id')
      .single<{ id: string }>(),
  );

  try {
    const [, , sections] = await Promise.all([
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
      // On "everyone" pages the database fills 'members' sections with the group.
      supabase
        .from('page_sections')
        .insert(
          spec.sections.map((s, position) => ({
            page_id: page.id,
            position,
            title: s.title,
            cell_type: s.cellType,
            notify: s.notify,
            auto_members: s.rows === 'members',
          })),
        )
        .select('id, position')
        .overrideTypes<{ id: string; position: number }[], { merge: false }>()
        .then(check),
    ]);

    const sectionIds = new Map(sections.map((s) => [s.position, s.id]));
    const rows = spec.sections.flatMap((section, sectionPosition) =>
      section.rows === 'members'
        ? []
        : section.rows.map((label, position) => ({
            page_id: page.id,
            section_id: sectionIds.get(sectionPosition),
            position,
            label,
            user_id: null,
          })),
    );
    if (rows.length > 0) {
      check(await supabase.from('page_rows').insert(rows));
    }
  } catch (e) {
    await supabase.from('pages').delete().eq('id', page.id);
    throw e;
  }

  return page.id;
}

export async function renamePage(pageId: string, title: string) {
  check(await supabase.from('pages').update({ title }).eq('id', pageId));
}

export async function setInstructions(pageId: string, instructions: string) {
  check(await supabase.from('pages').update({ instructions }).eq('id', pageId));
}

/** A choice as it should be after editing; no `id` means it's new. */
export type OptionEdit = { id?: string; value: string; label: string; colour: string };

/**
 * Saves a page's edited choices, keeping filled-in cells in step:
 * a changed short code (Y → P) is changed in every cell that used it, and a
 * removed choice is cleared from the cells that used it.
 */
export async function saveOptions(pageId: string, original: Option[], next: OptionEdit[]) {
  const before = new Map(original.map((o) => [o.id, o]));
  const finalValues = new Set(next.map((o) => o.value));
  const kept = next.filter((o) => o.id && before.has(o.id));
  const keptIds = new Set(kept.map((o) => o.id));
  const removed = original.filter((o) => !keptIds.has(o.id));
  const renamed = kept.filter((o) => before.get(o.id!)!.value !== o.value);

  // Choices: delete removed ones, then update the rest. Codes must stay unique
  // on a page, so changed codes go through a placeholder first (e.g. Y ⇄ N).
  if (removed.length > 0) {
    check(await supabase.from('page_options').delete().in('id', removed.map((o) => o.id)));
  }
  for (const [i, o] of renamed.entries()) {
    check(await supabase.from('page_options').update({ value: `~${i}` }).eq('id', o.id!));
  }
  const updates = kept.flatMap((o) => {
    const old = before.get(o.id!)!;
    const position = next.indexOf(o);
    if (
      old.value === o.value &&
      old.label === o.label &&
      old.colour === o.colour &&
      old.position === position
    ) {
      return [];
    }
    return [
      supabase
        .from('page_options')
        .update({ value: o.value, label: o.label, colour: o.colour, position })
        .eq('id', o.id!),
    ];
  });
  for (const result of await Promise.all(updates)) check(result);
  const added = next.flatMap((o, position) =>
    o.id && keptIds.has(o.id)
      ? []
      : [{ page_id: pageId, position, value: o.value, label: o.label, colour: o.colour }],
  );
  if (added.length > 0) check(await supabase.from('page_options').insert(added));

  // Cells: clear removed codes that nothing uses now, then move renamed codes
  // (through placeholders too, so swapping two codes works).
  const cleared = removed.map((o) => o.value).filter((v) => !finalValues.has(v));
  if (cleared.length > 0) {
    check(await supabase.from('cells').delete().eq('page_id', pageId).in('value', cleared));
  }
  for (const [i, o] of renamed.entries()) {
    const old = before.get(o.id!)!.value;
    check(await supabase.from('cells').update({ value: `~${i}` }).eq('page_id', pageId).eq('value', old));
  }
  for (const [i, o] of renamed.entries()) {
    check(await supabase.from('cells').update({ value: o.value }).eq('page_id', pageId).eq('value', `~${i}`));
  }
}

export async function renameSection(sectionId: string, title: string) {
  check(await supabase.from('page_sections').update({ title }).eq('id', sectionId));
}

/**
 * Adds a section to the end of a page. It holds people: on "everyone" pages
 * the database fills it with the whole group straight away.
 */
export async function addSection(
  pageId: string,
  position: number,
  title: string,
  cellType: CellType,
) {
  check(
    await supabase.from('page_sections').insert({
      page_id: pageId,
      position,
      title,
      cell_type: cellType,
      notify: false,
      auto_members: true,
    }),
  );
}

/** Deletes a section with all its rows and everything filled in on them. */
export async function deleteSection(sectionId: string) {
  check(await supabase.from('page_sections').delete().eq('id', sectionId));
}

/** Saves the page's new section order: `sectionIds` from top to bottom. */
export async function reorderSections(sectionIds: string[]) {
  const results = await Promise.all(
    sectionIds.map((id, position) =>
      supabase.from('page_sections').update({ position }).eq('id', id),
    ),
  );
  for (const result of results) check(result);
}

/** A column as it should be after editing; no `id` means it's new. */
export type ColumnEdit = { id?: string; position: number; label: string; date: string | null };

/**
 * Saves a page's edited columns. Columns missing from `next` are deleted
 * along with everything filled in under them; the rest are added or updated.
 */
export async function saveColumns(pageId: string, original: Column[], next: ColumnEdit[]) {
  const kept = new Set(next.flatMap((c) => (c.id ? [c.id] : [])));
  const removed = original.filter((c) => !kept.has(c.id)).map((c) => c.id);
  if (removed.length > 0) {
    check(await supabase.from('page_columns').delete().in('id', removed));
  }

  const before = new Map(original.map((c) => [c.id, c]));
  const updates = next.flatMap((c) => {
    const old = c.id ? before.get(c.id) : undefined;
    if (!c.id || !old || (old.label === c.label && old.position === c.position)) return [];
    return [
      supabase
        .from('page_columns')
        .update({ label: c.label, position: c.position })
        .eq('id', c.id),
    ];
  });
  for (const result of await Promise.all(updates)) check(result);

  const added = next.filter((c) => !c.id);
  if (added.length > 0) {
    check(
      await supabase
        .from('page_columns')
        .insert(added.map(({ position, label, date }) => ({ page_id: pageId, position, label, date }))),
    );
  }
}

/**
 * Adds a row with just a name, for someone who isn't on Ovelo (e.g.
 * "Grandma") or an extra fixed row (e.g. "Van"). Admins only.
 */
export async function addNamedRow(
  pageId: string,
  sectionId: string,
  position: number,
  label: string,
) {
  check(
    await supabase
      .from('page_rows')
      .insert({ page_id: pageId, section_id: sectionId, position, label, user_id: null }),
  );
}

export async function renameRow(rowId: string, label: string) {
  check(await supabase.from('page_rows').update({ label }).eq('id', rowId));
}

/** Removes a row and everything filled in on it. */
export async function removeRow(rowId: string) {
  check(await supabase.from('page_rows').delete().eq('id', rowId));
}

/** Saves a section's new order: `rowIds` from top to bottom. */
export async function reorderRows(rowIds: string[]) {
  const results = await Promise.all(
    rowIds.map((id, position) => supabase.from('page_rows').update({ position }).eq('id', id)),
  );
  for (const result of results) check(result);
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

/** Turns "Everyone in every section" on (filling in anyone missing) or off. Admins only. */
export async function setPageEveryone(pageId: string, everyone: boolean) {
  check(await supabase.from('pages').update({ auto_members: everyone }).eq('id', pageId));
}

/**
 * Puts a group member in a section, or takes them out (deleting their row).
 * Anyone can do this for themselves; admins can do it for anyone.
 */
export async function setSectionMember(sectionId: string, userId: string, inSection: boolean) {
  const { error } = await supabase.rpc('set_section_member', {
    sid: sectionId,
    uid: userId,
    in_section: inSection,
  });
  if (error) throw error;
}
