-- Let people delete their own account (the App Store requires this).
--
-- The app can't delete sign-in accounts directly, so delete_my_account()
-- runs as a security definer. Deleting the auth user cascades to the
-- profile and group memberships, and the existing triggers remove the
-- person's page rows.

-- Groups and pages someone made stay for everyone else; just forget who
-- made them.
alter table public.groups alter column created_by drop not null;
alter table public.groups drop constraint groups_created_by_fkey;
alter table public.groups add constraint groups_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.pages alter column created_by drop not null;
alter table public.pages drop constraint pages_created_by_fkey;
alter table public.pages add constraint pages_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  stuck text;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  -- Groups that would be left with members but no admin.
  select string_agg('"' || g.name || '"', ', ') into stuck
  from public.groups g
  join public.group_members m on m.group_id = g.id and m.user_id = me and m.role = 'admin'
  where not exists (
      select 1 from public.group_members o
      where o.group_id = g.id and o.user_id <> me and o.role = 'admin'
    )
    and exists (select 1 from public.group_members o where o.group_id = g.id and o.user_id <> me);
  if stuck is not null then
    raise exception 'You''re the only admin of %. Make someone else an admin first.', stuck;
  end if;

  -- Groups where you're the only member go, with their pages.
  delete from public.groups g
  where exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = me)
    and not exists (select 1 from public.group_members o where o.group_id = g.id and o.user_id <> me);

  -- Leave every other group first, so the member-left trigger removes your
  -- rows. (Deleting the auth user straight away would clear their user_id
  -- before that trigger could find them.)
  delete from public.group_members where user_id = me;

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
