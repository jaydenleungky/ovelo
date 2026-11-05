// Turns errors from the network, sign-in and the database into plain
// sentences for people, instead of showing raw messages like
// "TypeError: Failed to fetch".

export const OFFLINE_MESSAGE =
  'You’re offline or the connection dropped. Check your internet and try again.';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/** Known messages (matched case-insensitively) and what to say instead. */
const KNOWN: [RegExp, string][] = [
  [/failed to fetch|network ?request failed|networkerror|fetch failed|load failed|network error|timed? ?out/, OFFLINE_MESSAGE],
  [/invalid login credentials/, 'That email and password don’t match. Check them, or reset your password.'],
  [/email not confirmed/, 'Confirm your email first: open the link we sent you, then sign in.'],
  [/user already registered|already been registered/, 'There’s already an account with that email. Try signing in instead.'],
  [/token has expired or is invalid|otp.*(expired|invalid)/, 'That code has expired or isn’t right. Ask for a new one.'],
  [/email rate limit|over_email_send_rate_limit|too many requests|rate limit/, 'Too many tries in a short time. Please wait a few minutes and try again.'],
  [/password should be at least/, 'Your password needs to be at least 6 characters.'],
  [/jwt expired|invalid jwt|session.*(expired|missing)|refresh token/, 'Your sign-in has expired. Please sign out and sign in again.'],
  [/row-level security|permission denied|not authorized|42501/, 'You don’t have permission to do that. Ask a group admin.'],
  [/duplicate key|already exists|23505/, 'That already exists.'],
  [/json object requested|no rows|pgrst116/, 'That couldn’t be found. It may have been deleted.'],
];

/** Words that suggest a message is meant for developers, not people. */
const TECHNICAL = /typeerror|undefined|null|column|relation|syntax|schema|constraint|stack|\bat\b .*\(|\{|\}/i;

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const { message, code } = error as { message?: unknown; code?: unknown };
    const text = typeof message === 'string' ? message : '';
    return typeof code === 'string' ? `${text} ${code}` : text;
  }
  return '';
}

/**
 * A short, plain sentence describing what went wrong. Messages Ovelo's own
 * database functions raise (e.g. "A group needs at least one admin…") are
 * already written for people, so they're kept as they are.
 */
export function friendlyError(error: unknown, fallback = GENERIC_MESSAGE): string {
  const raw = messageOf(error).trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  for (const [pattern, friendly] of KNOWN) {
    if (pattern.test(lower)) return friendly;
  }
  // Keep short, readable messages; hide anything technical.
  const text = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : raw;
  if (text.length <= 140 && !TECHNICAL.test(text)) return text;
  return fallback;
}
