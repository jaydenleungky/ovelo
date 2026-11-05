import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { joinGroup } from '@/lib/groups';
import { INVITE_CODE_LENGTH as CODE_LENGTH, cleanInviteCode } from '@/lib/invites';

export default function JoinGroupScreen() {
  const theme = useTheme();
  // Filled in when arriving from an invite link.
  const params = useLocalSearchParams<{ code?: string }>();
  const invited = cleanInviteCode(params.code ?? '');
  const [code, setCode] = useState(invited);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (code.trim().length !== CODE_LENGTH) {
      setError(`Invite codes are ${CODE_LENGTH} characters long.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const group = await joinGroup(code);
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the group.');
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">
          {invited
            ? 'You’ve been invited to a group. Tap Join group to join it.'
            : `Ask someone in the group for their ${CODE_LENGTH}-character invite code.`}
        </ThemedText>
        <TextField
          label="Invite code"
          value={code}
          onChangeText={(text) => setCode(cleanInviteCode(text))}
          placeholder="e.g. A3F9K2"
          autoFocus={!invited}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LENGTH}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
          style={styles.codeInput}
        />
        {error && (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
            {error}
          </ThemedText>
        )}
        <Button title="Join group" onPress={handleJoin} loading={submitting} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 6,
    textAlign: 'center',
  },
});
