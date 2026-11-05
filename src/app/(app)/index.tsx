import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { RenameSheet } from '@/components/rename-sheet';
import { ScreenFade } from '@/components/screen-fade';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWideScreen } from '@/hooks/use-wide-screen';
import { deleteMyAccount, signOut, useAuth } from '@/lib/auth';
import { confirmAction, showMessage } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { listMyGroups, type MyGroup } from '@/lib/groups';
import { takePendingInvite } from '@/lib/pending-invite';
import { MAX_DISPLAY_NAME_LENGTH, getMyDisplayName, setDisplayName } from '@/lib/profile';

export default function HomeScreen() {
  const theme = useTheme();
  // Wide screens: groups as a grid of cards, with your account in a side panel.
  const wide = useWideScreen();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Try again" runs the latest load again.
  const retry = useRef<(() => void) | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  // Arrived from an invite link before signing in: carry on to joining.
  useEffect(() => {
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/groups/join', params: { code } });
  }, []);

  // Reload whenever this screen comes back into view, e.g. after
  // creating, joining or leaving a group.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      function load() {
        Promise.all([listMyGroups(userId!), getMyDisplayName(userId!)])
          .then(([result, displayName]) => {
            if (!active) return;
            setGroups(result);
            setName(displayName);
            setError(null);
          })
          .catch((e: unknown) => active && setError(friendlyError(e)));
      }
      retry.current = load;
      load();
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
      showMessage("Couldn't change your name", friendlyError(e));
    }
  }

  async function confirmDeleteAccount() {
    const confirmed = await confirmAction({
      title: 'Delete your account?',
      message:
        'This can’t be undone. Your account, your name and everything you’ve filled in on pages will be deleted, and you’ll leave all your groups. Groups where you’re the only member are deleted too.',
      confirmText: 'Delete account',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteMyAccount();
      // Signed out, so the app returns to the sign-in screen.
    } catch (e) {
      showMessage("Couldn't delete your account", friendlyError(e));
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e) {
      showMessage('Could not sign out', friendlyError(e));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenFade />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
        <View style={[styles.content, wide && styles.contentWide]}>
          <View style={[styles.main, wide && styles.mainWide]}>
            <ThemedText type="subtitle">Your groups</ThemedText>

            {error && (
              <View style={styles.list}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  Couldn&apos;t load your groups. {error}
                </ThemedText>
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => {
                    setError(null);
                    retry.current?.();
                  }}
                />
              </View>
            )}

            {groups === null && !error && <ActivityIndicator />}

            {groups?.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">No groups yet</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Create a group for your family or team, or join one with an invite code someone
                  sent you.
                </ThemedText>
              </ThemedView>
            )}

            <View style={wide ? styles.grid : styles.list}>
              {groups?.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`} asChild>
                  <Pressable
                    style={({ pressed }) => [wide && styles.gridItem, pressed && styles.pressed]}>
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
            </View>

            <View style={[styles.actions, wide && styles.actionsWide]}>
              <View style={wide && styles.actionItem}>
                <Button title="Create a group" onPress={() => router.push('/groups/new')} />
              </View>
              <View style={wide && styles.actionItem}>
                <Button
                  title="Join with a code"
                  variant="secondary"
                  onPress={() => router.push('/groups/join')}
                />
              </View>
            </View>
          </View>

          <View
            style={[
              styles.footer,
              wide && [
                styles.panel,
                { borderColor: theme.border, backgroundColor: theme.background },
              ],
            ]}>
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
                <ThemedText type="small" style={{ color: theme.link, fontWeight: 600 }}>
                  Change
                </ThemedText>
              </ThemedView>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as {session?.user.email}
            </ThemedText>
            <Button title="Sign out" variant="secondary" onPress={handleSignOut} />
            <Pressable
              accessibilityRole="button"
              onPress={confirmDeleteAccount}
              style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
              <ThemedText type="small" style={{ color: theme.danger, fontWeight: 600 }}>
                Delete account
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/privacy')}
              style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Privacy policy
              </ThemedText>
            </Pressable>
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

const WIDE_CONTENT_WIDTH = 1100;

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
  contentWide: {
    maxWidth: WIDE_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.four,
  },
  main: {
    gap: Spacing.three,
  },
  mainWide: {
    flex: 2,
  },
  list: {
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  gridItem: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  panel: {
    flex: 1,
    marginTop: 0,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
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
  actionsWide: {
    flexDirection: 'row',
  },
  actionItem: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  footer: {
    gap: Spacing.two,
    marginTop: Spacing.five,
  },
});
