-- Ovelo initial schema: groups, members and customisable grid pages.
-- See docs/DESIGN.md for how these map onto meal plans and rosters.

-------------------------------------------------------------------------------
-- Profiles (one per signed-up user)
-------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Create a profile automatically whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Groups and membership
-------------------------------------------------------------------------------

create type public.member_role as enum ('admin', 'member');

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

-------------------------------------------------------------------------------
-- Pages: a grid of rows (grouped into sections) by columns
-------------------------------------------------------------------------------

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  instructions text not null default '',
  column_mode text not null default 'weekdays'
    check (column_mode in ('weekdays', 'dates')),
  template text not null default 'blank'
    check (template in ('meal_plan', 'roster', 'blank')),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index pages_group_id_idx on public.pages (group_id);

-- Days or dates across the top, e.g. "Monday" or "6 Nov (Fri)".
create table public.page_columns (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  position int not null,
  label text not null,
  date date,
  unique (id, page_id)
);

-- The legend, e.g. Y = "Prefer to serve" (green), N = "Not available" (red).
create table public.page_options (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  position int not null,
  value text not null,
  label text not null default '',
  colour text not null default '#9CA3AF',
  unique (page_id, value)
);

-- Groups of rows, e.g. "Lunch" / "Dinner" or "Vocalists" / "Drummers".
-- Text sections hold free text instead of options, e.g. "Car Use".
create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  position int not null,
  title text not null,
  cell_type text not null default 'option' check (cell_type in ('option', 'text')),
  notify boolean not null default false,
  unique (id, page_id)
);

-- One line in a section, usually a person. user_id links it to a member
-- so they can tick it off as done ("bold your name once you're done").
create table public.page_rows (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null,
  section_id uuid not null,
  position int not null,
  label text not null,
  user_id uuid references auth.users (id) on delete set null,
  is_done boolean not null default false,
  unique (id, page_id),
  foreign key (section_id, page_id)
    references public.page_sections (id, page_id) on delete cascade
);

-- The value at one row x column. page_id is stored so the app can
-- subscribe to realtime changes for a single page.
create table public.cells (
  page_id uuid not null,
  row_id uuid not null,
  column_id uuid not null,
  value text not null default '',
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (row_id, column_id),
  foreign key (row_id, page_id)
    references public.page_rows (id, page_id) on delete cascade,
  foreign key (column_id, page_id)
    references public.page_columns (id, page_id) on delete cascade
);

create index page_columns_page_id_idx on public.page_columns (page_id);
create index page_options_page_id_idx on public.page_options (page_id);
create index page_sections_page_id_idx on public.page_sections (page_id);
create index page_rows_page_id_idx on public.page_rows (page_id);
create index cells_page_id_idx on public.cells (page_id);

-- Record who last edited a cell and when.
create function public.touch_cell()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger cells_touch
  before insert or update on public.cells
  for each row execute function public.touch_cell();

-------------------------------------------------------------------------------
-- Permission helpers (security definer so policies don't recurse)
-------------------------------------------------------------------------------

create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$;

create function public.is_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.can_view_page(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pages p
    join public.group_members m on m.group_id = p.group_id
    where p.id = pid and m.user_id = (select auth.uid())
  );
$$;

create function public.can_edit_page_layout(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pages p
    join public.group_members m on m.group_id = p.group_id
    where p.id = pid and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create function public.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

-------------------------------------------------------------------------------
-- Actions the app calls (creating and joining groups)
-------------------------------------------------------------------------------

-- Creates a group and makes the caller its first admin.
create function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.groups (name, created_by)
  values (group_name, auth.uid())
  returning * into new_group;

  insert into public.group_members (group_id, user_id, role)
  values (new_group.id, auth.uid(), 'admin');

  return new_group;
end;
$$;

-- Joins the group with this invite code (case-insensitive).
create function public.join_group(code text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into found_group
  from public.groups
  where invite_code = upper(trim(code));

  if found_group.id is null then
    raise exception 'No group found with that invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (found_group.id, auth.uid())
  on conflict do nothing;

  return found_group;
end;
$$;

revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-------------------------------------------------------------------------------
-- Row level security
-------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.pages enable row level security;
alter table public.page_columns enable row level security;
alter table public.page_options enable row level security;
alter table public.page_sections enable row level security;
alter table public.page_rows enable row level security;
alter table public.cells enable row level security;

-- Profiles: see yourself and people in your groups; edit only yourself.
create policy "View own and group members' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));
create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Groups: members can see them; admins can rename or delete them.
-- Creating and joining go through create_group / join_group.
create policy "Members view group" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "Admins update group" on public.groups
  for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "Admins delete group" on public.groups
  for delete to authenticated using (public.is_group_admin(id));

-- Membership: members see each other; admins manage roles; anyone can leave.
create policy "Members view membership" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "Admins change roles" on public.group_members
  for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "Admins remove members or members leave" on public.group_members
  for delete to authenticated
  using (public.is_group_admin(group_id) or user_id = (select auth.uid()));

-- Pages: members can view; admins create, edit and delete.
create policy "Members view pages" on public.pages
  for select to authenticated using (public.is_group_member(group_id));
create policy "Admins create pages" on public.pages
  for insert to authenticated with check (public.is_group_admin(group_id));
create policy "Admins update pages" on public.pages
  for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "Admins delete pages" on public.pages
  for delete to authenticated using (public.is_group_admin(group_id));

-- Page layout (columns, options, sections, rows): members view, admins edit.
create policy "Members view columns" on public.page_columns
  for select to authenticated using (public.can_view_page(page_id));
create policy "Admins edit columns" on public.page_columns
  for all to authenticated
  using (public.can_edit_page_layout(page_id))
  with check (public.can_edit_page_layout(page_id));

create policy "Members view options" on public.page_options
  for select to authenticated using (public.can_view_page(page_id));
create policy "Admins edit options" on public.page_options
  for all to authenticated
  using (public.can_edit_page_layout(page_id))
  with check (public.can_edit_page_layout(page_id));

create policy "Members view sections" on public.page_sections
  for select to authenticated using (public.can_view_page(page_id));
create policy "Admins edit sections" on public.page_sections
  for all to authenticated
  using (public.can_edit_page_layout(page_id))
  with check (public.can_edit_page_layout(page_id));

create policy "Members view rows" on public.page_rows
  for select to authenticated using (public.can_view_page(page_id));
create policy "Admins edit rows" on public.page_rows
  for all to authenticated
  using (public.can_edit_page_layout(page_id))
  with check (public.can_edit_page_layout(page_id));
-- Lets a member mark their own row as done.
create policy "Members update own row" on public.page_rows
  for update to authenticated
  using (user_id = (select auth.uid()) and public.can_view_page(page_id))
  with check (user_id = (select auth.uid()) and public.can_view_page(page_id));

-- Cells: any member of the page's group can fill them in.
create policy "Members view cells" on public.cells
  for select to authenticated using (public.can_view_page(page_id));
create policy "Members add cells" on public.cells
  for insert to authenticated with check (public.can_view_page(page_id));
create policy "Members update cells" on public.cells
  for update to authenticated
  using (public.can_view_page(page_id)) with check (public.can_view_page(page_id));
create policy "Members clear cells" on public.cells
  for delete to authenticated using (public.can_view_page(page_id));

-------------------------------------------------------------------------------
-- Grants and realtime
-------------------------------------------------------------------------------

grant select, insert, update, delete on
  public.profiles, public.groups, public.group_members, public.pages,
  public.page_columns, public.page_options, public.page_sections,
  public.page_rows, public.cells
to authenticated;

-- Broadcast changes so other phones update instantly.
alter publication supabase_realtime add table public.cells, public.page_rows;
