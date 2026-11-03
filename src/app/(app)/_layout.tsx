import { Stack } from 'expo-router';

// Screens in (app) are only reachable while signed in (see the root layout).
export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Ovelo' }} />
    </Stack>
  );
}
