-- The app limits how long names and text can be, but the database didn't,
-- so anyone calling the API directly could save, say, a 10,000-character
-- group name and break the layout for everyone in the group. These match the
-- app's limits.
--
-- NOT VALID: every new or changed value is checked; values already saved are
-- left alone, so this can't fail on existing data.

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 40) not valid;

alter table public.groups
  add constraint groups_name_length check (char_length(name) <= 60) not valid;

alter table public.pages
  add constraint pages_title_length check (char_length(title) <= 60) not valid,
  add constraint pages_instructions_length check (char_length(instructions) <= 500) not valid;

alter table public.page_columns
  add constraint page_columns_label_length check (char_length(label) <= 30) not valid;

alter table public.page_options
  add constraint page_options_value_length check (char_length(value) <= 3) not valid,
  add constraint page_options_label_length check (char_length(label) <= 30) not valid;

alter table public.page_sections
  add constraint page_sections_title_length check (char_length(title) <= 40) not valid;

alter table public.page_rows
  add constraint page_rows_label_length check (char_length(label) <= 40) not valid;

alter table public.cells
  add constraint cells_value_length check (char_length(value) <= 60) not valid;
