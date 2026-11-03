# Ovelo — Design

Ovelo lets a group (a family, a band, a volunteer team) share customisable
grid "pages": people down the side, days or dates across the top, and a
value in each cell. Everyone in the group sees edits in real time.

The same model covers both motivating use cases:

| Concept   | Family meal plan             | Worship roster                         |
|-----------|------------------------------|----------------------------------------|
| Group     | The family                   | Youth worship team                     |
| Page      | "Meal Planning 2025"         | "November Roster"                      |
| Columns   | Mon–Sun (repeating week)     | Specific dates (6 Nov, 7 Nov, …)       |
| Sections  | Lunch, Dinner, Car Use       | Vocalists, Guitarists, Drummers, …     |
| Rows      | Jones, Jenny, Jayden, …      | Genevieve (WL), Megan, Isaac, …        |
| Options   | Y = eating, N = not eating   | Y = prefer, N = unavailable, blank = available |
| Notes     | —                            | Instructions box at the top            |
| Done flag | —                            | "Bold your name once you're done"      |

## Data model (Supabase / Postgres)

The schema lives in `supabase/migrations/`.

- **profiles**: `id` (= auth user), `display_name`; created on sign-up
- **groups**: `id`, `name`, `invite_code`, `created_by`
- **group_members**: `group_id`, `user_id`, `role` (`admin` | `member`)
- **pages**: `id`, `group_id`, `title`, `instructions`, `column_mode`
  (`weekdays` | `dates` | `custom`), `template` (`meal_plan` | `roster` |
  `blank`, where `blank` is a page designed from scratch in the page builder)
- **page_columns**: `id`, `page_id`, `position`, `label`, `date` (nullable)
- **page_options**: `id`, `page_id`, `position`, `value` (e.g. `Y`), `label`, `colour`
- **page_sections**: `id`, `page_id`, `position`, `title`, `cell_type`
  (`option` | `text`, so "Car Use" can hold free text such as "Dad 2–5pm"), `notify`
- **page_rows**: `id`, `page_id`, `section_id`, `position`, `label`,
  `user_id` (nullable, links a row to a member), `is_done`
- **cells**: `page_id`, `row_id`, `column_id`, `value`, `updated_by`,
  `updated_at` (primary key `row_id, column_id`)

Child tables carry `page_id`, with composite foreign keys so a row, column and
cell can never point at different pages.

Row Level Security: a user can read a page's data only if they are in
`group_members` for that page's group. Any member can fill in cells; only
admins can change page layout (columns, sections, rows, options). Members can
mark their own row as done. Groups are created and joined through the
`create_group(name)` and `join_group(code)` functions.

## Real time and notifications

- Clients subscribe to `cells` changes for the open page (Supabase Realtime).
- Sections can be marked `notify`; edits there (e.g. Car Use) send a push
  notification to the group via `expo-notifications`.

## Build order

1. Auth (email sign-in) and profiles
2. Create or join a group with an invite code
3. Page list, then a read-only grid view
4. Editing cells (tap to cycle options, or type text)
5. Real-time sync
6. Page builder: add/reorder columns, sections, rows, options; templates
7. Push notifications for `notify` sections
8. Polish, then TestFlight / Play Store internal testing
