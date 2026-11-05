import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { cleanInviteCode } from '@/lib/invites';
import { savePendingInvite } from '@/lib/pending-invite';

/**
 * Invite links (ovelo.expo.app/join?code=ABC123) land here. Signed in, go
 * straight to joining with the code filled in. Signed out, remember the code
 * and go to sign-in; it's picked up again once they're in.
 */
export default function JoinLink() {
  const { session } = useAuth();
  const { code: raw } = useLocalSearchParams<{ code?: string }>();
  const code = cleanInviteCode(raw ?? '');

  useEffect(() => {
    if (!session && code) savePendingInvite(code);
  }, [session, code]);

  if (!session) return <Redirect href="/sign-in" />;
  return <Redirect href={{ pathname: '/groups/join', params: code ? { code } : {} }} />;
}
