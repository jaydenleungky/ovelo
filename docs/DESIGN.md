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

- **groups**: `id`, `name`, `invite_code`
- **group_members**: `group_id`, `user_id`, `role` (`admin` | `member`)
- **profiles**: `id` (= auth user), `display_name`
- **pages**: `id`, `group_id`, `title`, `instructions`, `column_mode`
  (`weekdays` | `dates`), `template` (`meal_plan` | `roster` | `blank`)
- **page_columns**: `id`, `page_id`, `position`, `label`, `date` (nullable)
- **page_options**: `id`, `page_id`, `value` (e.g. `Y`), `label`, `colour`
- **sections**: `id`, `page_id`, `position`, `title`, `cell_type`
  (`option` | `text`), so "Car Use" can hold free text such as "Dad 2–5pm"
- **rows**: `id`, `section_id`, `position`, `label`, `user_id` (nullable,
  links a row to a member), `is_done`
- **cells**: `row_id`, `column_id`, `value`, `updated_by`, `updated_at`
  (primary key `row_id, column_id`)

Row Level Security: a user can read and write a page's data only if they are
in `group_members` for that page's group. Only admins can change page
structure (columns, sections, rows, options).

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
