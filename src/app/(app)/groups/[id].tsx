import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { MemberSheet } from '@/components/member-sheet';
import { ScreenFade } from '@/components/screen-fade';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWideScreen } from '@/hooks/use-wide-screen';
import { useAuth } from '@/lib/auth';
import { confirmAction, shareText, showMessage } from '@/lib/dialogs';
import {
  deleteGroup,
  getGroup,
  leaveGroup,
  listMembers,
  removeMember,
  setMemberRole,
  type Group,
  type Member,
} from '@/lib/groups';
import { inviteMessage } from '@/lib/invites';
import { listPages, type PageSummary } from '@/lib/pages';

const TEMPLATE_EMOJI: Record<PageSummary['template'], string> = {
  meal_plan: '🍽️',
  roster: '🎵',
  blank: '✏️',
};

const COLUMN_MODE_LABEL: Record<PageSummary['column_mode'], string> = {
  weekdays: 'Weekly',
  dates: 'By date',
  custom: 'Custom columns',
};

export default function GroupScreen() {
  const theme = useTheme();
  // Wide screens: pages on the left, invite code and members in a side panel.
  const wide = useWideScreen();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reloadMembers = useCallback(() => {
    listMembers(id)
      .then(setMembers)
      .catch(() => {});
  }, [id]);

  // Reload whenever the screen comes into view.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getGroup(id), listMembers(id), listPages(id)])
        .then(([g, m, p]) => {
          if (!active) return;
          setGroup(g);
          setMembers(m);
          setPages(p);
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
  const iAmAdmin = me?.role === 'admin';
  const selected = members.find((m) => m.user_id === selectedId);

  async function toggleAdmin(member: Member) {
    const role = member.role === 'admin' ? 'member' : 'admin';
    setSelectedId(null);
    setMembers((list) => list.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)));
    try {
      await setMemberRole(id, member.user_id, role);
    } catch (e) {
      showMessage("Couldn't change their role", e instanceof Error ? e.message : undefined);
    }
    reloadMembers();
  }

  async function confirmRemove(member: Member) {
    setSelectedId(null);
    const confirmed = await confirmAction({
      title: `Remove ${member.display_name} from "${group?.name}"?`,
      message:
        'Their rows on this group’s pages, and everything filled in on them, will be lost. They’ll need an invite code to join again.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await removeMember(id, member.user_id);
    } catch (e) {
      showMessage("Couldn't remove them", e instanceof Error ? e.message : undefined);
    }
    reloadMembers();
  }

  async function handleShare() {
    if (!group) return;
    await shareText(inviteMessage(group.name, group.invite_code));
  }

  async function confirmLeave() {
    if (!group || !userId) return;
    if (isOnlyAdmin) {
      showMessage(
        "You're the only admin",
        'Make someone else an admin first: tap their name under Members.',
      );
      return;
    }
    const confirmed = await confirmAction({
      title: isLastMember ? `Delete "${group.name}"?` : `Leave "${group.name}"?`,
      message: isLastMember
        ? "You're the last member, so the group and all its pages will be deleted."
        : "You'll need a new invite code to join again.",
      confirmText: isLastMember ? 'Delete' : 'Leave',
      destructive: true,
    });
    if (!confirmed) return;

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
      showMessage('Something went wrong', e instanceof Error ? e.message : undefined);
    }
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
      <ScreenFade />
      <Stack.Screen options={{ title: group.name }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
        <View style={[styles.content, wide && styles.contentWide]}>
          <View style={[styles.section, wide && styles.mainWide]}>
            <ThemedText type="smallBold">Pages</ThemedText>
            {pages.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {me?.role === 'admin'
                    ? 'No pages yet. Create a meal plan or roster to get started.'
                    : 'No pages yet. An admin can create a meal plan or roster.'}
                </ThemedText>
              </ThemedView>
            )}
            <View style={wide ? styles.grid : styles.section}>
              {pages.map((page) => (
                <Link key={page.id} href={`/pages/${page.id}`} asChild>
                  <Pressable
                    style={({ pressed }) => [wide && styles.gridItem, pressed && styles.pressed]}>
                    <ThemedView type="backgroundElement" style={styles.pageRow}>
                      <ThemedText style={styles.pageEmoji}>
                        {TEMPLATE_EMOJI[page.template]}
                      </ThemedText>
                      <View style={styles.pageText}>
                        <ThemedText type="smallBold">{page.title}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {COLUMN_MODE_LABEL[page.column_mode]}
                        </ThemedText>
                      </View>
                      <ThemedText themeColor="textSecondary">›</ThemedText>
                    </ThemedView>
                  </Pressable>
                </Link>
              ))}
            </View>
            {me?.role === 'admin' && (
              <Button
                title="New page"
                onPress={() =>
                  router.push({ pathname: '/pages/new', params: { groupId: group.id } })
                }
              />
            )}
          </View>

          <View style={[styles.side, wide && styles.sideWide]}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Invite code</ThemedText>
              <ThemedText
                style={styles.code}
                selectable
                accessibilityLabel={`Invite code ${group.invite_code.split('').join(' ')}`}>
                {group.invite_code}
              </ThemedText>
              <Button title="Share invite" onPress={handleShare} />
            </ThemedView>

            <View style={styles.section}>
              <ThemedText type="smallBold">Members ({members.length})</ThemedText>
              {iAmAdmin && members.length > 1 && (
                <ThemedText type="small" themeColor="textSecondary">
                  Tap someone to make them an admin or remove them from the group.
                </ThemedText>
              )}
              <ThemedView type="backgroundElement" style={styles.list}>
                {members.map((member, index) => (
                  <Pressable
                    key={member.user_id}
                    disabled={!iAmAdmin}
                    accessibilityRole={iAmAdmin ? 'button' : undefined}
                    accessibilityLabel={`${member.display_name}${member.user_id === userId ? ' (you)' : ''}${
                      member.role === 'admin' ? ', admin' : ''
                    }${iAmAdmin ? '. Tap to manage.' : ''}`}
                    onPress={() => setSelectedId(member.user_id)}
                    style={({ pressed }) => [
                      styles.memberRow,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderColor: theme.border,
                      },
                      pressed && styles.pressed,
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
                    {iAmAdmin && <ThemedText themeColor="textSecondary"> ›</ThemedText>}
                  </Pressable>
                ))}
              </ThemedView>
            </View>

            <Button
              title={isLastMember ? 'Delete group' : 'Leave group'}
              variant="danger"
              onPress={confirmLeave}
              loading={busy}
            />
          </View>
        </View>
      </ScrollView>

      {selected && (
        <MemberSheet
          member={selected}
          isMe={selected.user_id === userId}
          isOnlyAdmin={selected.role === 'admin' && adminCount === 1}
          onToggleAdmin={() => toggleAdmin(selected)}
          onRemove={() => confirmRemove(selected)}
          onClose={() => setSelectedId(null)}
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
  contentWide: {
    maxWidth: WIDE_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainWide: {
    flex: 2,
  },
  side: {
    gap: Spacing.four,
  },
  sideWide: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  gridItem: {
    flexBasis: '45%',
    flexGrow: 1,
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
  pressed: {
    opacity: 0.7,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pageEmoji: {
    fontSize: 24,
    lineHeight: 32,
  },
  pageText: {
    flex: 1,
    gap: Spacing.half,
  },
});
