-- Pages can now have their columns (and next, their choices) edited after
-- they're made. Send those changes live, like cells, rows and sections.
alter publication supabase_realtime add table public.page_columns, public.page_options;
