import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { RenameSheet } from '@/components/rename-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signOut, useAuth } from '@/lib/auth';
import { showMessage } from '@/lib/dialogs';
import { listMyGroups, type MyGroup } from '@/lib/groups';
import { MAX_DISPLAY_NAME_LENGTH, getMyDisplayName, setDisplayName } from '@/lib/profile';

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  // Reload whenever this screen comes back into view, e.g. after
  // creating, joining or leaving a group.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      Promise.all([listMyGroups(userId), getMyDisplayName(userId)])
        .then(([result, displayName]) => {
          if (!active) return;
          setGroups(result);
          setName(displayName);
          setError(null);
        })
        .catch((e: Error) => active && setError(e.message));
      return () => {
        active = false;
      };
    }, [userId]),
  );

  async function handleRename(next: string) {
    const previous = name;
    setName(next);
    try {
      await setDisplayName(next);
    } catch (e) {
      setName(previous);
      showMessage("Couldn't change your name", e instanceof Error ? e.message : undefined);
    }
  }

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Your name: ${name ?? ''}. Tap to change it.`}
              disabled={name === null}
              onPress={() => setEditingName(true)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={[styles.card, styles.groupRow]}>
                <View style={styles.groupText}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Your name
                  </ThemedText>
                  <ThemedText type="smallBold">{name || 'Not set'}</ThemedText>
                </View>
                <ThemedText type="small" style={{ color: theme.tint }}>
                  Change
                </ThemedText>
              </ThemedView>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as {session?.user.email}
            </ThemedText>
            <Button title="Sign out" variant="secondary" onPress={handleSignOut} />
          </View>
        </View>
      </ScrollView>

      {editingName && (
        <RenameSheet
          heading="Your name"
          note="This is how you appear in your groups and on pages."
          value={name ?? ''}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          onSave={handleRename}
          onClose={() => setEditingName(false)}
        />
      )}
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
