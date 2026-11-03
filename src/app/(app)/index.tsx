import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { signOut, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Read the profile row created by the sign-up trigger.
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => setDisplayName(data?.display_name ?? ''));
  }, [userId]);

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Could not sign out', e instanceof Error ? e.message : undefined);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.greeting}>
            <ThemedText type="subtitle">
              {displayName === null ? 'Hi!' : `Hi, ${displayName || 'there'} 👋`}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Signed in as {session?.user.email}
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Coming next</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Create a group for your family or team, or join one with an invite code.
            </ThemedText>
          </ThemedView>

          <Button title="Sign out" variant="secondary" onPress={handleSignOut} />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  greeting: {
    gap: Spacing.one,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
