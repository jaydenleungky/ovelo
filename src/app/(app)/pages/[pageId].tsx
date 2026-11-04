import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { GridBody, GridHeader, Legend, gridWidth, useGridScrollSync } from '@/components/page-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { confirmAction, showMessage } from '@/lib/dialogs';
import { getMyRole, type Role } from '@/lib/groups';
import { deletePage, getPageData, type PageData } from '@/lib/pages';

const COLUMN_WORD = { weekdays: 'day', dates: 'date', custom: 'column' } as const;
const SHORT_SCREEN_HEIGHT = 500;

export default function PageScreen() {
  const theme = useTheme();
  const { pageId } = useLocalSearchParams<{ pageId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { headerRef, onBodyScroll } = useGridScrollSync();
  const screen = useWindowDimensions();

  const [data, setData] = useState<PageData | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = not toggled yet: start open, except on short (landscape) screens
  // where the card would push the grid out of view.
  const [instructionsToggled, setInstructionsToggled] = useState<boolean | null>(null);

  // Reload when coming back into view, e.g. after adding people.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      getPageData(pageId)
        .then(async (result) => {
          const myRole = await getMyRole(result.page.group_id, userId);
          if (!active) return;
          setData(result);
          setRole(myRole);
          setError(null);
        })
        .catch((e: Error) => active && setError(e.message));
      return () => {
        active = false;
      };
    }, [pageId, userId]),
  );

  const isAdmin = role === 'admin';

  async function confirmDelete() {
    if (!data) return;
    const confirmed = await confirmAction({
      title: `Delete "${data.page.title}"?`,
      message: 'Everything filled in on this page will be lost.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deletePage(data.page.id);
      router.back();
    } catch (e) {
      showMessage('Could not delete', e instanceof Error ? e.message : undefined);
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

  if (!data) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const hasRows = data.rows.length > 0;
  const showInstructions = instructionsToggled ?? screen.height >= SHORT_SCREEN_HEIGHT;
  const overflows = gridWidth(data) > screen.width;
  const showRotateTip = overflows && Platform.OS !== 'web' && screen.height > screen.width;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: data.page.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.scroll}>
        {/* 0: intro (scrolls away) */}
        <View style={styles.intro}>
          {data.page.instructions !== '' && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showInstructions }}
              onPress={() => setInstructionsToggled(!showInstructions)}>
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText type="smallBold">How to fill this in</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {showInstructions ? 'Hide' : 'Show'}
                  </ThemedText>
                </View>
                {showInstructions && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {data.page.instructions}
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>
          )}
          {data.options.length > 0 && (
            <Legend
              options={data.options}
              blankLabel={data.page.template === 'roster' ? 'Available' : undefined}
            />
          )}
          {!hasRows && isAdmin && (
            <ThemedText type="small" themeColor="textSecondary">
              Tap “+ Add person” under each section to add your team.
            </ThemedText>
          )}
        </View>

        {/* 1: sticky header */}
        <GridHeader data={data} headerRef={headerRef} />

        {/* 2: grid */}
        <GridBody
          data={data}
          currentUserId={userId}
          canEditLayout={isAdmin}
          onBodyScroll={onBodyScroll}
          onAddRow={(sectionId, sectionTitle) =>
            router.push({
              pathname: '/pages/add-row',
              params: {
                pageId: data.page.id,
                groupId: data.page.group_id,
                sectionId,
                sectionTitle,
              },
            })
          }
        />

        {/* 3: footer */}
        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {overflows
              ? `Scroll sideways to see every ${COLUMN_WORD[data.page.column_mode]}.`
              : ''}
            {showRotateTip ? ' Or turn your phone sideways to see more at once.' : ''}
            {overflows ? '\n' : ''}Tapping cells to fill them in is coming next.
          </ThemedText>
          {isAdmin && <Button title="Delete page" variant="secondary" onPress={confirmDelete} />}
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
    paddingBottom: Spacing.six,
  },
  intro: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  hint: {
    textAlign: 'center',
  },
});
