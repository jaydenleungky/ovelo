-- Allow pages whose columns are free-text labels (e.g. "Week 1", "Term 2")
-- rather than weekdays or dates.

alter table public.pages drop constraint pages_column_mode_check;

alter table public.pages
  add constraint pages_column_mode_check
  check (column_mode in ('weekdays', 'dates', 'custom'));
