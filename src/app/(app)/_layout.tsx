import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

// Screens in (app) are only reachable while signed in (see the root layout).
export default function AppLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        // In landscape the notch and rounded corners sit on the left and
        // right edges; keep content clear of them. These are 0 in portrait.
        contentStyle: {
          backgroundColor: theme.background,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      }}>
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
      <Stack.Screen name="pages/[pageId]" options={{ title: '' }} />
      <Stack.Screen name="pages/new" options={{ title: 'New page', presentation: 'modal' }} />
      <Stack.Screen
        name="pages/add-row"
        options={{ title: 'Add people', presentation: 'modal' }}
      />
    </Stack>
  );
}
