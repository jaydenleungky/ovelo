-- Tighten who can fill in cells. A member can edit a row's cells if:
--   * the row is theirs (page_rows.user_id = them),
--   * the row isn't linked to anyone (e.g. "Car", or someone not on Ovelo), or
--   * they're an admin of the page's group.
-- Previously any member could edit any cell.

create function public.can_edit_row(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.page_rows r
    join public.pages p on p.id = r.page_id
    join public.group_members m
      on m.group_id = p.group_id and m.user_id = (select auth.uid())
    where r.id = rid
      and (r.user_id is null or r.user_id = (select auth.uid()) or m.role = 'admin')
  );
$$;

drop policy "Members add cells" on public.cells;
drop policy "Members update cells" on public.cells;
drop policy "Members clear cells" on public.cells;

create policy "Add cells in editable rows" on public.cells
  for insert to authenticated with check (public.can_edit_row(row_id));
create policy "Update cells in editable rows" on public.cells
  for update to authenticated
  using (public.can_edit_row(row_id)) with check (public.can_edit_row(row_id));
create policy "Clear cells in editable rows" on public.cells
  for delete to authenticated using (public.can_edit_row(row_id));
