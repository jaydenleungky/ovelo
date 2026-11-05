import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Member } from '@/lib/groups';

type MemberSheetProps = {
  member: Member;
  isMe: boolean;
  /** This is the group's only admin, so they can't step down yet. */
  isOnlyAdmin: boolean;
  onToggleAdmin: () => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Admins tap a member to change their role or remove them from the group. */
export function MemberSheet({
  member,
  isMe,
  isOnlyAdmin,
  onToggleAdmin,
  onRemove,
  onClose,
}: MemberSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isAdmin = member.role === 'admin';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <ThemedView
          style={[
            styles.sheet,
            { paddingBottom: Spacing.four + insets.bottom, borderColor: theme.border },
          ]}>
          <View style={styles.header}>
            <ThemedText type="smallBold">
              {member.display_name}
              {isMe ? ' (you)' : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {isAdmin
                ? 'Admin · can create and edit pages, and manage members'
                : 'Member · can fill in pages'}
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <Button
              title={isAdmin ? (isMe ? 'Stop being an admin' : 'Remove as admin') : 'Make admin'}
              variant={isAdmin ? 'secondary' : 'primary'}
              onPress={onToggleAdmin}
              disabled={isAdmin && isOnlyAdmin}
            />
            {isAdmin && isOnlyAdmin && (
              <ThemedText type="small" themeColor="textSecondary">
                A group needs at least one admin. Make someone else an admin first.
              </ThemedText>
            )}
            {!isMe && (
              <Pressable
                accessibilityRole="button"
                onPress={onRemove}
                style={({ pressed }) => [styles.removeLink, pressed && styles.pressed]}>
                <ThemedText type="small" style={{ color: theme.danger, fontWeight: 600 }}>
                  Remove from group
                </ThemedText>
              </Pressable>
            )}
            <Button title="Done" variant="secondary" onPress={onClose} />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Dim the whole screen, including beside a narrow sheet on wide screens.
  fill: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  header: {
    gap: Spacing.half,
  },
  actions: {
    gap: Spacing.two,
  },
  removeLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
