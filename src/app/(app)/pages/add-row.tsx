import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listMembers, type Member } from '@/lib/groups';
import { addRows, listSectionRows } from '@/lib/pages';

export default function AddRowScreen() {
  const theme = useTheme();
  const { pageId, groupId, sectionId, sectionTitle } = useLocalSearchParams<{
    pageId: string;
    groupId: string;
    sectionId: string;
    sectionTitle: string;
  }>();

  const [members, setMembers] = useState<Member[] | null>(null);
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string[]>([]);
  const [otherNames, setOtherNames] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listMembers(groupId), listSectionRows(sectionId)])
      .then(([m, rows]) => {
        if (!active) return;
        setMembers(m);
        setAlreadyIn(new Set(rows.flatMap((r) => (r.user_id ? [r.user_id] : []))));
      })
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [groupId, sectionId]);

  function togglePicked(userId: string) {
    setPicked((p) => (p.includes(userId) ? p.filter((id) => id !== userId) : [...p, userId]));
  }

  function addOtherName() {
    const trimmed = name.trim();
    if (trimmed && !otherNames.includes(trimmed)) setOtherNames([...otherNames, trimmed]);
    setName('');
  }

  const total = picked.length + otherNames.length + (name.trim() ? 1 : 0);

  async function handleAdd() {
    const names = name.trim() ? [...otherNames, name.trim()] : otherNames;
    const entries = [
      ...(members ?? [])
        .filter((m) => picked.includes(m.user_id))
        .map((m) => ({ label: m.display_name, user_id: m.user_id })),
      ...names.map((label) => ({ label, user_id: null })),
    ];
    if (entries.length === 0) {
      setError('Pick someone or type a name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addRows(pageId, sectionId, entries);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add people.');
      setSubmitting(false);
    }
  }

  const available = members?.filter((m) => !alreadyIn.has(m.user_id)) ?? [];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `Add to ${sectionTitle}` }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <ThemedText type="smallBold">Group members</ThemedText>
          {members === null && !error && <ActivityIndicator />}
          {members !== null && available.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Everyone in the group is already in {sectionTitle}.
            </ThemedText>
          )}
          <View style={styles.chips}>
            {available.map((m) => (
              <Chip
                key={m.user_id}
                label={m.display_name}
                selected={picked.includes(m.user_id)}
                onPress={() => togglePicked(m.user_id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Someone not on Ovelo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add a name for anyone who doesn&apos;t use the app. You can fill in their row for them.
          </ThemedText>
          {otherNames.length > 0 && (
            <View style={styles.chips}>
              {otherNames.map((n) => (
                <Chip key={n} label={n} onRemove={() => setOtherNames(otherNames.filter((x) => x !== n))} />
              ))}
            </View>
          )}
          <View style={styles.addRow}>
            <View style={styles.addInput}>
              <TextField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Caleb"
                returnKeyType="done"
                onSubmitEditing={addOtherName}
              />
            </View>
            <Button title="Add" variant="secondary" onPress={addOtherName} />
          </View>
        </View>

        {error && (
          <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
            {error}
          </ThemedText>
        )}

        <Button
          title={total > 0 ? `Add ${total} ${total === 1 ? 'person' : 'people'}` : 'Add people'}
          onPress={handleAdd}
          loading={submitting}
          disabled={total === 0}
        />
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
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  addInput: {
    flex: 1,
  },
});
