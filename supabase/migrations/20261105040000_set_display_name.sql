-- Change your display name, and with it the name on your rows.
--
-- Members can't edit rows directly (only admins can), so this runs as a
-- security definer function. Only rows still showing your old name change:
-- if an admin renamed you on a page (e.g. "Jayden (WL)"), that's kept.
create function public.set_display_name(new_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  trimmed text := trim(new_name);
  old_label text;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if length(trimmed) = 0 or length(trimmed) > 40 then
    raise exception 'Names must be 1 to 40 characters';
  end if;

  -- Rows were labelled with the old name, or "Member" if there wasn't one.
  select coalesce(nullif(display_name, ''), 'Member') into old_label
  from public.profiles where id = me;

  update public.profiles set display_name = trimmed where id = me;
  update public.page_rows set label = trimmed where user_id = me and label = old_label;
end;
$$;

revoke execute on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;
