import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  /** True until the saved session (if any) has been loaded from the device. */
  isLoading: boolean;
  /**
   * True between entering a reset code (which signs you in) and saving the
   * new password, so the reset screen stays open until it's done.
   */
  isResettingPassword: boolean;
  /** Checks the emailed code, then sets the new password. */
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    // Fires once on start with the saved session, then on every sign-in/out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function resetPassword(email: string, code: string, password: string) {
    // Flag this first: verifying the code signs you in straight away.
    setIsResettingPassword(true);
    if (!session) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (error) {
        setIsResettingPassword(false);
        throw error;
      }
    }
    // If this fails you're signed in but still on the reset screen to retry.
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setIsResettingPassword(false);
  }

  return (
    <AuthContext value={{ session, isLoading, isResettingPassword, resetPassword }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Signs in (or signs up) with a Google account.
 *
 * On the web the page goes to Google and comes back signed in. In the app,
 * Google opens in a browser sheet that returns to Ovelo with a code, which
 * is swapped for a session. Returns false if the person closed the sheet.
 */
export async function signInWithGoogle(): Promise<boolean> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return true;
  }

  // exp://… (or exps://… over a tunnel) in Expo Go, ovelo://… in the real app.
  // Each scheme must be in Supabase's Redirect URLs list.
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const params = Linking.parse(result.url).queryParams ?? {};
  if (typeof params.error_description === 'string') throw new Error(params.error_description);
  if (typeof params.code !== 'string') throw new Error('Google sign-in didn’t finish. Please try again.');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
  if (exchangeError) throw exchangeError;
  return true;
}

/** Creates an account. Returns true if the user must confirm their email first. */
export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Read by the handle_new_user trigger to fill in profiles.display_name.
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  // With email confirmation on, Supabase doesn't say an email is taken (so
  // nobody can find out who has an account); it returns a user with no
  // identities instead, and sends no email. Say so rather than "check your inbox".
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('There’s already an account with that email. Try signing in, or reset your password.');
  }
  return data.session === null;
}

/** Emails a code for resetting a forgotten password. */
export async function sendPasswordResetCode(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/**
 * Deletes your account, profile and rows for good. Groups where you're the
 * only member are deleted too. Refuses if you're the only admin of a group
 * that has other people in it.
 */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // The account is gone, so just forget the session on this device.
  await supabase.auth.signOut({ scope: 'local' });
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
