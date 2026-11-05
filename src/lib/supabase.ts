import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { authStorage } from '@/lib/auth-storage';
// Before the client is made: it checks for Web Crypto when signing in.
import '@/lib/crypto-polyfill';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Keeps users signed in across app launches and page reloads.
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Google sign-in returns with a one-time code to swap for a session. On
    // the web Supabase reads it from the page address after the redirect;
    // in the app we swap it ourselves (see signInWithGoogle).
    flowType: 'pkce',
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Only refresh the login token while the app is open, as Supabase recommends.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

/** Returns true if the Supabase project is reachable with our key. */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabasePublishableKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}
