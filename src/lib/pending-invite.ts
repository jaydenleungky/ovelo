// An invite code waiting while someone signs in or creates an account,
// e.g. after opening an invite link while signed out. In the app it only
// needs to last while the app is open.
let pending: string | null = null;

export function savePendingInvite(code: string) {
  pending = code;
}

/** Returns the waiting code, if any, and forgets it. */
export function takePendingInvite(): string | null {
  const code = pending;
  pending = null;
  return code;
}

export function hasPendingInvite() {
  return pending !== null;
}
