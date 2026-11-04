-- 1. "I'm done" is now an option each page can switch on (off by default).
alter table public.pages add column track_done boolean not null default false;

-- 2. Choices are now drawn as solid tiles with white letters. Deepen the
--    two palette colours that were too light for white text (~3:1 → ~5:1).
update public.page_options set colour = '#15803D' where upper(colour) = '#16A34A';
update public.page_options set colour = '#B45309' where upper(colour) = '#D97706';
