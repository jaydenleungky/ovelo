// On the web, Google sign-in leaves the page and comes back, so the waiting
// invite code is kept in the browser's storage rather than in memory.
const KEY = 'ovelo.pendingInvite';

export function savePendingInvite(code: string) {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // Storage can be blocked (e.g. private browsing); the code is just lost.
  }
}

/** Returns the waiting code, if any, and forgets it. */
export function takePendingInvite(): string | null {
  try {
    const code = window.localStorage.getItem(KEY);
    window.localStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}

export function hasPendingInvite() {
  try {
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
