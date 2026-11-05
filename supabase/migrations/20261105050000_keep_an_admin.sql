-- Admins can now make others admins and remove members from the app. The
-- existing policies already allow that; this adds two guards:
--   * a group with members always keeps at least one admin, and
--   * only a membership's role can be changed, not whose or which group's
--     membership it is.
create function public.check_group_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid := coalesce(old.group_id, new.group_id);
begin
  if tg_op = 'UPDATE' and (new.group_id <> old.group_id or new.user_id <> old.user_id) then
    raise exception 'Only a member''s role can be changed';
  end if;

  -- Skipped when the whole group is being deleted (it's already gone here).
  if exists (select 1 from public.groups where id = gid)
    and exists (select 1 from public.group_members where group_id = gid)
    and not exists (select 1 from public.group_members where group_id = gid and role = 'admin')
  then
    raise exception 'A group needs at least one admin. Make someone else an admin first.';
  end if;
  return null;
end;
$$;

create trigger on_group_members_changed
  after update or delete on public.group_members
  for each row execute function public.check_group_members();

revoke execute on function public.check_group_members() from public, anon, authenticated;
