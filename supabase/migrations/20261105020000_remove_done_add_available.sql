-- 1. Rosters no longer treat a blank cell as "available": "A" is now a
--    choice of its own, so a blank cell just means "not answered yet".
-- 2. That makes the "I'm done" button unnecessary, so it's removed.

-- Existing rosters get an "A = Available" choice between Y and N.
-- Blank cells are left blank: they're now unanswered, not available.
update public.page_options o
set position = o.position + 1
from public.pages pg
where pg.id = o.page_id and pg.template = 'roster' and o.position >= 1
  and not exists (select 1 from public.page_options a where a.page_id = o.page_id and a.value = 'A');

insert into public.page_options (page_id, position, value, label, colour)
select pg.id, 1, 'A', 'Available', '#2563EB'
from public.pages pg
where pg.template = 'roster'
  and not exists (select 1 from public.page_options a where a.page_id = pg.id and a.value = 'A');

update public.pages
set instructions = E'Y = I''d prefer to serve on this date\nA = I''m available\nN = I''m not available'
where template = 'roster'
  and instructions = E'Y = I''d prefer to serve on this date\nN = I''m not available\nLeave blank if you''re available.';

-- The "I'm done" button. Its policy only existed so members could tick
-- off their own row; without it, only admins change rows directly.
-- "if exists" so this is safe to run again.
drop policy if exists "Members update own row" on public.page_rows;
alter table public.page_rows drop column if exists is_done;
alter table public.pages drop column if exists track_done;
