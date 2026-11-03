import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createGroup } from '@/lib/groups';

export default function NewGroupScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Please give your group a name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const group = await createGroup(name.trim());
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the group.');
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">
          You&apos;ll be the admin, and you&apos;ll get an invite code to share with everyone
          else.
        </ThemedText>
        <TextField
          label="Group name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Leung Family or Youth Worship"
          autoFocus
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        {error && (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
            {error}
          </ThemedText>
        )}
        <Button title="Create group" onPress={handleCreate} loading={submitting} />
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
});
