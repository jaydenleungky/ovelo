import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import { showMessage } from '@/lib/dialogs';
import { listMyGroups, type MyGroup } from '@/lib/groups';

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reload whenever this screen comes back into view, e.g. after
  // creating, joining or leaving a group.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      listMyGroups(userId)
        .then((result) => {
          if (!active) return;
          setGroups(result);
          setError(null);
        })
        .catch((e: Error) => active && setError(e.message));
      return () => {
        active = false;
      };
    }, [userId]),
  );

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e) {
      showMessage('Could not sign out', e instanceof Error ? e.message : undefined);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <ThemedText type="subtitle">Your groups</ThemedText>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Couldn&apos;t load your groups: {error}
            </ThemedText>
          )}

          {groups === null && !error && <ActivityIndicator />}

          {groups?.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">No groups yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Create a group for your family or team, or join one with an invite code
                someone sent you.
              </ThemedText>
            </ThemedView>
          )}

          {groups?.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`} asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={[styles.card, styles.groupRow]}>
                  <View style={styles.groupText}>
                    <ThemedText type="smallBold">{group.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {group.role === 'admin' ? 'Admin' : 'Member'}
                    </ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary">›</ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          ))}

          <View style={styles.actions}>
            <Button title="Create a group" onPress={() => router.push('/groups/new')} />
            <Button
              title="Join with a code"
              variant="secondary"
              onPress={() => router.push('/groups/join')}
            />
          </View>

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as {session?.user.email}
            </ThemedText>
            <Button title="Sign out" variant="secondary" onPress={handleSignOut} />
          </View>
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
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  footer: {
    gap: Spacing.two,
    marginTop: Spacing.five,
  },
});
