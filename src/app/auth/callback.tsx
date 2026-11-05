import { Redirect } from 'expo-router';

/**
 * Where Google sign-in sends people back to. The sign-in code handles the
 * result; if the app is opened at this address (e.g. on Android), just go home.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
