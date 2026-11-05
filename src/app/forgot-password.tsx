import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ScreenFade } from '@/components/screen-fade';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sendPasswordResetCode, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Reset a forgotten password with a code from your email: no link to open,
 * so it works the same in the app and in a browser.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { resetPassword, isResettingPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    if (!email.trim()) return setError('Please enter your email.');
    setSubmitting(true);
    setError(null);
    try {
      await sendPasswordResetCode(email.trim());
      setStep('code');
    } catch (e) {
      setError(friendlyError(e, 'Could not send the code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    const digits = code.replace(/\s/g, '');
    // While signed in from a code that worked, only the password is left.
    if (!isResettingPassword && !/^\d{6,10}$/.test(digits)) {
      return setError('Enter the code from the email.');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(email.trim(), digits, password);
      // Done: you're signed in, and the app switches to your groups.
    } catch (e) {
      setError(friendlyError(e, 'Something went wrong. Please try again.'));
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenFade />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <View style={styles.header}>
                <ThemedText type="subtitle">Reset your password</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {step === 'email'
                    ? 'We’ll email you a code to set a new password.'
                    : `Enter the code we sent to ${email.trim()}, and choose a new password.`}
                </ThemedText>
              </View>

              <View style={styles.form}>
                {step === 'email' ? (
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
                    returnKeyType="send"
                    onSubmitEditing={handleSendCode}
                  />
                ) : (
                  <>
                    {!isResettingPassword && (
                      <TextField
                        label="Code"
                        value={code}
                        onChangeText={setCode}
                        placeholder="123456"
                        keyboardType="number-pad"
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        maxLength={12}
                      />
                    )}
                    <TextField
                      label="New password"
                      value={password}
                      onChangeText={setPassword}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="done"
                      onSubmitEditing={handleReset}
                    />
                  </>
                )}

                {error && (
                  <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
                    {error}
                  </ThemedText>
                )}

                {step === 'email' ? (
                  <Button title="Send code" onPress={handleSendCode} loading={submitting} />
                ) : (
                  <Button title="Set new password" onPress={handleReset} loading={submitting} />
                )}

                {step === 'code' && !isResettingPassword && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setStep('email');
                      setCode('');
                      setError(null);
                    }}
                    style={styles.link}>
                    <ThemedText type="small" style={{ color: theme.link, fontWeight: 600 }}>
                      Didn’t get it? Check your spam folder, or send a new code
                    </ThemedText>
                  </Pressable>
                )}
                {!isResettingPassword && (
                  <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.link}>
                    <ThemedText type="small" style={{ color: theme.link, fontWeight: 600 }}>
                      Back to sign in
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
  form: {
    gap: Spacing.three,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
});
