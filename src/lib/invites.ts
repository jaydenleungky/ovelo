/** The live website, used in invite links shared from anywhere (app or web). */
export const SITE_URL = 'https://ovelo.expo.app';

export const INVITE_CODE_LENGTH = 6;

/** Keeps only the letters and digits of a code, in capitals. */
export function cleanInviteCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, INVITE_CODE_LENGTH);
}

/** A link that opens Ovelo with the code already filled in. */
export function inviteLink(code: string) {
  return `${SITE_URL}/join?code=${encodeURIComponent(code)}`;
}

/** The message sent when someone taps "Share invite". */
export function inviteMessage(groupName: string, code: string) {
  return (
    `Join "${groupName}" on Ovelo: ${inviteLink(code)}\n\n` +
    `Or open ${SITE_URL}, sign in, tap "Join with a code" and enter ${code}.`
  );
}
