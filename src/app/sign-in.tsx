import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signIn, signUp } from '@/lib/auth';

type Mode = 'sign-in' | 'sign-up';

const MIN_PASSWORD_LENGTH = 6;

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  function validate(): string | null {
    if (isSignUp && !displayName.trim()) return 'Please enter your name.';
    if (!email.trim()) return 'Please enter your email.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    setError(problem);
    setNotice(null);
    if (problem) return;

    setSubmitting(true);
    try {
      if (isSignUp) {
        const needsConfirmation = await signUp(email.trim(), password, displayName.trim());
        if (needsConfirmation) {
          setNotice(`We've sent a confirmation link to ${email.trim()}. Open it, then sign in.`);
          setMode('sign-in');
        }
      } else {
        await signIn(email.trim(), password);
      }
      // On success the auth listener updates the session and the app
      // switches to the signed-in screens automatically.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <View style={styles.header}>
                <ThemedText type="title">Ovelo</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Plan meals and rosters together.
                </ThemedText>
              </View>

              <ThemedView type="backgroundElement" style={styles.tabs}>
                {(['sign-in', 'sign-up'] as const).map((m) => (
                  <Pressable
                    key={m}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === m }}
                    onPress={() => switchMode(m)}
                    style={[styles.tab, mode === m && { backgroundColor: theme.background }]}>
                    <ThemedText
                      type="smallBold"
                      themeColor={mode === m ? 'text' : 'textSecondary'}>
                      {m === 'sign-in' ? 'Sign in' : 'Create account'}
                    </ThemedText>
                  </Pressable>
                ))}
              </ThemedView>

              <View style={styles.form}>
                {isSignUp && (
                  <TextField
                    label="Your name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="e.g. Jayden"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                  />
                )}
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />

                {error && (
                  <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
                    {error}
                  </ThemedText>
                )}
                {notice && (
                  <ThemedText type="small" accessibilityRole="alert">
                    {notice}
                  </ThemedText>
                )}

                <Button
                  title={isSignUp ? 'Create account' : 'Sign in'}
                  onPress={handleSubmit}
                  loading={submitting}
                />
                {!isSignUp && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/forgot-password')}
                    style={styles.link}>
                    <ThemedText type="small" style={{ color: theme.tint }}>
                      Forgot password?
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth / 2,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  tabs: {
    flexDirection: 'row',
    padding: Spacing.half,
    borderRadius: Spacing.three,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three - Spacing.half,
  },
  form: {
    gap: Spacing.three,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
});
