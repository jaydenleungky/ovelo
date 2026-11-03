import { Stack } from 'expo-router';

// Screens in (app) are only reachable while signed in (see the root layout).
export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Ovelo' }} />
      <Stack.Screen name="groups/[id]" options={{ title: '' }} />
      <Stack.Screen
        name="groups/new"
        options={{ title: 'New group', presentation: 'modal' }}
      />
      <Stack.Screen
        name="groups/join"
        options={{ title: 'Join a group', presentation: 'modal' }}
      />
    </Stack>
  );
}
