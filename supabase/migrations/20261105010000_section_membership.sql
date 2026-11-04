-- Not every page should put everyone in every section: on a worship roster
-- you're only in the sections for the instruments you play.
--
-- 1. pages.auto_members: "Everyone in every section". When on (meal plans),
--    members are added to every section as before. When off (rosters),
--    sections start empty and people choose which ones they're in.
-- 2. set_section_member(): put someone in or take them out of a section.
--    Members can do this for themselves; admins can do it for anyone.
--
-- (page_sections.auto_members still says whether a section holds people at
-- all, as opposed to fixed rows like the meal plan's shared "Car" row.)

alter table public.pages add column auto_members boolean not null default true;

-- Rosters are where this matters. Existing rows stay; admins can untick them.
update public.pages set auto_members = false where template = 'roster';

-- New sections only fill up on "everyone" pages.
create or replace function public.handle_new_section()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select pg.auto_members from public.pages pg where pg.id = new.page_id) then
    perform public.add_member_rows(new.id);
  end if;
  return null;
end;
$$;

-- People joining the group are only added to "everyone" pages.
create or replace function public.handle_member_joined()
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
    where pg.group_id = new.group_id and pg.auto_members and s.auto_members
    order by pg.created_at, s.position
  loop
    perform public.add_member_rows(sid, new.user_id);
  end loop;
  return null;
end;
$$;

-- Switching "Everyone in every section" on fills in anyone missing.
create function public.handle_page_everyone_on()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.add_member_rows(s.id)
  from public.page_sections s
  where s.page_id = new.id and s.auto_members;
  return null;
end;
$$;

create trigger on_page_everyone_on
  after update of auto_members on public.pages
  for each row when (new.auto_members and not old.auto_members)
  execute function public.handle_page_everyone_on();

revoke execute on function public.handle_page_everyone_on() from public, anon, authenticated;

-- Put a group member in a section (in_section = true) or take them out.
-- Taking someone out deletes their row and anything filled in on it.
create function public.set_section_member(sid uuid, uid uuid, in_section boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
  holds_people boolean;
begin
  select pg.group_id, s.auto_members into gid, holds_people
  from public.page_sections s
  join public.pages pg on pg.id = s.page_id
  where s.id = sid;

  if gid is null or not public.is_group_member(gid) then
    raise exception 'Section not found';
  end if;
  if uid is distinct from (select auth.uid()) and not public.is_group_admin(gid) then
    raise exception 'Only admins can change who else is in a section';
  end if;
  if not holds_people then
    raise exception 'This section has fixed rows';
  end if;
  if not exists (select 1 from public.group_members where group_id = gid and user_id = uid) then
    raise exception 'They are not in this group';
  end if;

  if in_section then
    perform public.add_member_rows(sid, uid);
  else
    delete from public.page_rows where section_id = sid and user_id = uid;
  end if;
end;
$$;

revoke execute on function public.set_section_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_section_member(uuid, uuid, boolean) to authenticated;
