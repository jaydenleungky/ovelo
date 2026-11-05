import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenFade } from '@/components/screen-fade';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const UPDATED = '5 November 2026';
const CONTACT_EMAIL = 'jaydenleung2011@gmail.com';

/** Sections of the policy: a heading and its paragraphs or bullet points. */
const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'What Ovelo is',
    body: [
      'Ovelo lets families and teams share planning pages, such as weekly meal plans and rosters. It is a personal project run by Jayden Leung.',
    ],
  },
  {
    heading: 'What we collect',
    body: [
      '• Your email address, to sign you in and send account emails (confirming sign-up and resetting your password).',
      '• Your name, which you choose and can change at any time.',
      '• If you sign in with Google: your name and email address from your Google account. Ovelo doesn’t get your Google password or access to anything else in your Google account.',
      '• The groups you create or join, and what you fill in on their pages.',
      'Your password is stored securely by our sign-in provider and is never visible to us.',
    ],
  },
  {
    heading: 'How it’s used',
    body: [
      'Only to run Ovelo: signing you in, showing your groups and pages, and keeping them up to date for everyone in the group. There are no ads, no tracking or analytics, and your information is never sold.',
    ],
  },
  {
    heading: 'Who can see it',
    body: [
      'People in your groups can see your name and what you fill in on that group’s pages. Group admins can also rename or remove people. Nobody outside a group can see its pages.',
    ],
  },
  {
    heading: 'Services that store it',
    body: [
      '• Supabase stores the database and handles sign-in.',
      '• Expo hosts the website.',
      '• Google provides “Continue with Google”, if you use it.',
      '• Account emails are sent through Gmail.',
      'These services may store data outside your country.',
    ],
  },
  {
    heading: 'Keeping or deleting it',
    body: [
      'Your information is kept for as long as you have an account. You can delete your account at any time from the bottom of the home screen. This deletes your sign-in, your name and everything you’ve filled in, and removes you from your groups. Groups where you’re the only member are deleted too.',
    ],
  },
  {
    heading: 'Changes and questions',
    body: [
      'If this policy changes, the date at the top will change too. For questions or requests about your information, email ' +
        CONTACT_EMAIL +
        '.',
    ],
  },
];

/** The privacy policy: open to everyone, signed in or not. */
export default function PrivacyScreen() {
  const theme = useTheme();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenFade />
      <Stack.Screen options={{ title: 'Privacy policy' }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <Pressable accessibilityRole="button" onPress={goBack} style={styles.back}>
              <ThemedText type="small" style={{ color: theme.link, fontWeight: 600 }}>
                ‹ Back to Ovelo
              </ThemedText>
            </Pressable>

            <View style={styles.header}>
              <ThemedText type="subtitle" accessibilityRole="header">
                Privacy policy
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Last updated {UPDATED}
              </ThemedText>
            </View>

            {SECTIONS.map((section) => (
              <View key={section.heading} style={styles.section}>
                <ThemedText type="smallBold" accessibilityRole="header">
                  {section.heading}
                </ThemedText>
                {section.body.map((line) => (
                  <ThemedText key={line} type="small" themeColor="textSecondary">
                    {line}
                  </ThemedText>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
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
    maxWidth: MaxContentWidth / 1.5,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
});
