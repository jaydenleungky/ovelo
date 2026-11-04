-- Group members now get rows automatically, instead of an admin adding them.
--
-- A section with auto_members on has one row per group member:
--   * a new section starts with everyone in the group,
--   * someone joining the group is added to the end of every such section,
--   * someone leaving the group has their rows (and cells) removed.
-- Sections with it off (e.g. the meal plan's shared "Car" row) keep fixed rows.

alter table public.page_sections add column auto_members boolean not null default false;

-- Existing pages: every section except "notify" ones (only Car use) holds people.
update public.page_sections set auto_members = not notify;

-- Adds a row for each given member who isn't in the section yet, after the
-- rows already there, oldest member first.
create function public.add_member_rows(sid uuid, only_user uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.page_rows (page_id, section_id, position, label, user_id)
  select s.page_id, s.id,
         coalesce((select max(r.position) + 1 from public.page_rows r where r.section_id = s.id), 0)
           + row_number() over (order by m.joined_at, m.user_id) - 1,
         coalesce(nullif(p.display_name, ''), 'Member'),
         m.user_id
  from public.page_sections s
  join public.pages pg on pg.id = s.page_id
  join public.group_members m on m.group_id = pg.group_id
  left join public.profiles p on p.id = m.user_id
  where s.id = sid
    and (only_user is null or m.user_id = only_user)
    and not exists (
      select 1 from public.page_rows r where r.section_id = s.id and r.user_id = m.user_id
    );
$$;

create function public.handle_new_section()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.add_member_rows(new.id);
  return null;
end;
$$;

create trigger on_section_created
  after insert on public.page_sections
  for each row when (new.auto_members)
  execute function public.handle_new_section();

create function public.handle_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  for sid in
    select s.id
    from public.page_sections s
    join public.pages pg on pg.id = s.page_id
    where pg.group_id = new.group_id and s.auto_members
    order by pg.created_at, s.position
  loop
    perform public.add_member_rows(sid, new.user_id);
  end loop;
  return null;
end;
$$;

create trigger on_member_joined
  after insert on public.group_members
  for each row execute function public.handle_member_joined();

create function public.handle_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.page_rows r
  using public.pages pg
  where pg.id = r.page_id and pg.group_id = old.group_id and r.user_id = old.user_id;
  return null;
end;
$$;

create trigger on_member_left
  after delete on public.group_members
  for each row execute function public.handle_member_left();

-- These run from triggers only; nobody should call them directly.
revoke execute on function public.add_member_rows(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_section() from public, anon, authenticated;
revoke execute on function public.handle_member_joined() from public, anon, authenticated;
revoke execute on function public.handle_member_left() from public, anon, authenticated;

-- Fill in anyone missing from existing sections.
select public.add_member_rows(id) from public.page_sections where auto_members;

-- Renaming the page and turning "I'm done" on or off now show up live too.
alter publication supabase_realtime add table public.pages, public.page_sections;
