import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

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

/** Creates an account. Returns true if the user must confirm their email first. */
export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Read by the handle_new_user trigger to fill in profiles.display_name.
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data.session === null;
}

/** Emails a code for resetting a forgotten password. */
export async function sendPasswordResetCode(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
