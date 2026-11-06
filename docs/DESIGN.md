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
| Options   | Y = eating, N = not eating   | Y = prefer, A = available, N = unavailable |
| Notes     | —                            | Instructions box at the top            |
| Who's in  | Everyone, in every section   | Each person picks their sections       |

## Data model (Supabase / Postgres)

The schema lives in `supabase/migrations/`.

- **profiles**: `id` (= auth user), `display_name`; created on sign-up
- **groups**: `id`, `name`, `invite_code`, `created_by`
- **group_members**: `group_id`, `user_id`, `role` (`admin` | `member`)
- **pages**: `id`, `group_id`, `title`, `instructions`, `column_mode`
  (`weekdays` | `dates` | `custom`), `template` (`meal_plan` | `roster` |
  `blank`, where `blank` is a page designed from scratch in the page builder),
  `auto_members` (everyone in the group is in every section), `weekly_dates`
  (Mon–Sun pages: show each week's dates, with fresh answers every week and
  past weeks kept; switched with `set_weekly_dates()`)
- **page_columns**: `id`, `page_id`, `position`, `label`, `date` (nullable)
- **page_options**: `id`, `page_id`, `position`, `value` (e.g. `Y`), `label`, `colour`
- **page_sections**: `id`, `page_id`, `position`, `title`, `cell_type`
  (`option` | `text`, so "Car Use" can hold free text such as "Dad 2–5pm"), `notify`,
  `auto_members` (holds people, rather than fixed rows like a shared "Car" row)
- **page_rows**: `id`, `page_id`, `section_id`, `position`, `label`,
  `user_id` (nullable, links a row to a member)
- **cells**: `page_id`, `row_id`, `column_id`, `week`, `value`, `updated_by`,
  `updated_at` (primary key `row_id, column_id, week`). `week` is the Monday
  of the week on pages with weekly dates, and `1970-01-01` ("no particular
  week") everywhere else.

Child tables carry `page_id`, with composite foreign keys so a row, column and
cell can never point at different pages.

Row Level Security: a user can read a page's data only if they are in
`group_members` for that page's group. Any member can fill in cells; only
admins can change page layout (columns, sections, rows, options). Groups are
created and joined through the `create_group(name)` and `join_group(code)`
functions.

Rows for people are managed by the database: on "everyone" pages, members are
added to every section when it's created or when they join the group, and
removed when they leave. On other pages (rosters), people add themselves to a
section with `set_section_member(section, user, in_section)`; admins can use it
for anyone. Every roster date gets an answer, so a blank cell means "not
answered yet".

## Email

Supabase sends sign-up confirmation and password reset emails through a
custom SMTP server (a Gmail app password for now; a transactional provider
such as Resend with Ovelo's own domain before release). Custom SMTP is what
makes the email templates editable.

Password reset uses a code rather than a link, so it works in Expo Go and
the browser without a hosted site or deep links. The **Reset password**
template must include `{{ .Token }}`:

```html
<h2>Reset your Ovelo password</h2>
<p>Your code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Enter it in the app to choose a new password. If you didn't ask for this, you can ignore this email.</p>
```

## Google sign-in

"Continue with Google" uses Supabase's Google provider with the PKCE flow.
On the web the page redirects to Google and back; in the app Google opens in
a browser sheet (`expo-web-browser`) that returns with a code, which is
swapped for a session. `expo-crypto` fills in Web Crypto on phones so the
code is protected with SHA-256.

Setup outside the code:
- Google Cloud project "Ovelo": a **Web application** OAuth client whose
  redirect URI is `https://<project>.supabase.co/auth/v1/callback`. The app
  is in **Testing**, so only listed test users can use Google sign-in until
  the branding is verified (that needs Ovelo's own domain and a privacy
  policy page).
- Supabase **Authentication → Sign In / Providers → Google**: the client ID
  and secret.
- Supabase **Authentication → URL Configuration → Redirect URLs**:
  `exp://**` and `exps://**` (Expo Go, `exps` over a tunnel), `ovelo://**`
  (app builds), `https://ovelo.expo.app/**` (the hosted site) and
  `http://localhost:8081/**`, `http://localhost:8082/**` (web in development).

New Google accounts take their display name from the Google profile.

## Hosting

The web app is live at **https://ovelo.expo.app**, on EAS Hosting. It's a
single-page app (`web.output: "single"`), and EAS Hosting serves it for any
path, so links to a group or page load directly.

To publish the current code, run `npm run deploy:web`. It exports the web
build to `dist/` (with the `EXPO_PUBLIC_` values from `.env.local`) and
deploys it to production. The live site only changes when this is run.

Supabase's **Site URL** is `https://ovelo.expo.app`, so sign-up
confirmation emails link to the live site.

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
