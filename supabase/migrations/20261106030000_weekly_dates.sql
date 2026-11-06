-- Weekly (Mon–Sun) pages can show each week's dates, with a fresh set of
-- answers every week and past weeks kept to look back on.
--
-- Each cell now belongs to a week (the Monday it starts on). Pages that don't
-- use dates keep their cells under 1970-01-01, which means "no particular
-- week", so they work exactly as before.

alter table public.cells add column week date not null default '1970-01-01';
alter table public.cells drop constraint cells_pkey;
alter table public.cells add primary key (row_id, column_id, week);

alter table public.pages add column weekly_dates boolean not null default false;

-- Turns "Dates for each week" on or off for a Mon–Sun page. Admins only.
-- On: the page's current (undated) answers move into this_week, so nothing
-- seems to disappear. Off: this_week's answers become the undated plan again.
-- Other weeks stay saved either way, ready if it's switched back on.
create function public.set_weekly_dates(pid uuid, turn_on boolean, this_week date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_page_layout(pid) then
    raise exception 'Only admins can change this';
  end if;
  if not exists (select 1 from public.pages where id = pid and column_mode = 'weekdays') then
    raise exception 'Only Mon–Sun pages can show dates';
  end if;

  if turn_on then
    -- Keep answers already saved for this week; the undated ones fill the gaps.
    update public.cells c set week = this_week
    where c.page_id = pid and c.week = '1970-01-01'
      and not exists (
        select 1 from public.cells d
        where d.row_id = c.row_id and d.column_id = c.column_id and d.week = this_week
      );
    delete from public.cells where page_id = pid and week = '1970-01-01';
  else
    delete from public.cells where page_id = pid and week = '1970-01-01';
    update public.cells set week = '1970-01-01' where page_id = pid and week = this_week;
  end if;

  update public.pages set weekly_dates = turn_on where id = pid;
end;
$$;

revoke execute on function public.set_weekly_dates(uuid, boolean, date) from public, anon;
grant execute on function public.set_weekly_dates(uuid, boolean, date) to authenticated;
