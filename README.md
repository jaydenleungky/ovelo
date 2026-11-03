# Ovelo

Shared planning grids for families and teams. Plan the week's meals, roster
a band or volunteer team, or track who has the car, all on one screen
that updates in real time for everyone in the group.

> **Status:** early development. See [docs/DESIGN.md](docs/DESIGN.md) for the
> data model and build order.

## Features (planned)

- **Groups**: create a family or team and invite members with a code
- **Custom pages**: choose columns (a repeating week or specific dates),
  sections, rows and a colour-coded legend (e.g. Y / N)
- **Templates**: meal plan and roster to start from
- **Real-time sync**: edits appear instantly on everyone's phone
- **Notifications**: alerts for time-sensitive sections like car use

## Tech stack

- [Expo](https://expo.dev) (React Native, TypeScript, Expo Router)
- [Supabase](https://supabase.com) (Postgres, auth, realtime)

## Running locally

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## License

[MIT](LICENSE)
