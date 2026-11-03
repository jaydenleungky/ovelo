import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import {
  deleteGroup,
  getGroup,
  leaveGroup,
  listMembers,
  type Group,
  type Member,
} from '@/lib/groups';

export default function GroupScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reload whenever the screen comes into view.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getGroup(id), listMembers(id)])
        .then(([g, m]) => {
          if (!active) return;
          setGroup(g);
          setMembers(m);
          setError(null);
        })
        .catch((e: Error) => active && setError(e.message));
      return () => {
        active = false;
      };
    }, [id]),
  );

  const me = members.find((m) => m.user_id === userId);
  const adminCount = members.filter((m) => m.role === 'admin').length;
  const isLastMember = members.length === 1;
  const isOnlyAdmin = me?.role === 'admin' && adminCount === 1 && !isLastMember;

  async function handleShare() {
    if (!group) return;
    await Share.share({
      message: `Join "${group.name}" on Ovelo! Open the app, tap "Join with a code" and enter: ${group.invite_code}`,
    });
  }

  function confirmLeave() {
    if (!group || !userId) return;
    if (isOnlyAdmin) {
      Alert.alert(
        "You're the only admin",
        'Someone else needs to be an admin before you can leave. Managing roles is coming soon.',
      );
      return;
    }
    const title = isLastMember ? `Delete "${group.name}"?` : `Leave "${group.name}"?`;
    const message = isLastMember
      ? "You're the last member, so the group and all its pages will be deleted."
      : "You'll need a new invite code to join again.";
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isLastMember ? 'Delete' : 'Leave',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            if (isLastMember) {
              await deleteGroup(group.id);
            } else {
              await leaveGroup(group.id, userId);
            }
            router.back();
          } catch (e) {
            setBusy(false);
            Alert.alert('Something went wrong', e instanceof Error ? e.message : undefined);
          }
        },
      },
    ]);
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  if (!group) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: group.name }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Invite code</ThemedText>
            <ThemedText style={styles.code} selectable accessibilityLabel={`Invite code ${group.invite_code.split('').join(' ')}`}>
              {group.invite_code}
            </ThemedText>
            <Button title="Share invite" onPress={handleShare} />
          </ThemedView>

          <View style={styles.section}>
            <ThemedText type="smallBold">
              Members ({members.length})
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.list}>
              {members.map((member, index) => (
                <View
                  key={member.user_id}
                  style={[
                    styles.memberRow,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                  ]}>
                  <ThemedText style={styles.memberName}>
                    {member.display_name}
                    {member.user_id === userId ? ' (you)' : ''}
                  </ThemedText>
                  {member.role === 'admin' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Admin
                    </ThemedText>
                  )}
                </View>
              ))}
            </ThemedView>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Pages</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Meal plans and rosters for this group will appear here. Coming next!
            </ThemedText>
          </ThemedView>

          <Button
            title={isLastMember ? 'Delete group' : 'Leave group'}
            variant="secondary"
            onPress={confirmLeave}
            loading={busy}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
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
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  code: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 700,
    letterSpacing: 6,
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  list: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  memberName: {
    flex: 1,
  },
});
