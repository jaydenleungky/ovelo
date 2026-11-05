# Ovelo

Shared planning grids for families and teams. Plan the week's meals, roster
a band or volunteer team, or track who has the car, all on one screen
that updates in real time for everyone in the group.

**Try it:** [ovelo.expo.app](https://ovelo.expo.app)

> **Status:** in active development. See [docs/DESIGN.md](docs/DESIGN.md) for
> the data model, setup and build order.

## Features

- **Groups**: create a family or team, invite members with a code, and
  choose who's an admin
- **Pages**: start from a meal plan or roster template, or design your own
  columns (a repeating week, specific dates or your own labels), sections
  and colour-coded choices (e.g. Y / A / N)
- **Edit in place**: tap a name, title, column or the legend to change it;
  hold and drag names or sections to reorder them
- **Real-time sync**: edits appear instantly on everyone's screen
- **Accounts**: sign in with Google or email, reset a forgotten password by
  emailed code, change your name or delete your account
- **Works everywhere**: phones (portrait and landscape) and the web

Planned: push notifications for time-sensitive sections like car use, and
App Store and Google Play releases.

## Tech stack

- [Expo](https://expo.dev) (React Native, TypeScript, Expo Router)
- [Supabase](https://supabase.com) (Postgres, auth, realtime)

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). The
database schema is in `supabase/migrations/`.

## Deploying the web app

```bash
npm run deploy:web
```

This builds the web app and publishes it to [ovelo.expo.app](https://ovelo.expo.app)
with EAS Hosting.

## License

[MIT](LICENSE)
