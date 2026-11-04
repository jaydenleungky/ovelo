// Pop-ups and sharing that work on phones and in the browser.
// React Native's Alert and Share do nothing (or very little) on web.

import { Alert, Platform, Share } from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText: string;
  destructive?: boolean;
};

/** Asks the user to confirm. Resolves true if they tap the confirm button. */
export function confirmAction({ title, message, confirmText, destructive }: ConfirmOptions) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Shows a simple message with an OK button. */
export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Opens the share sheet. On a computer browser with no share sheet, copies
 * the text instead and says so.
 */
export async function shareText(text: string) {
  if (Platform.OS !== 'web') {
    await Share.share({ message: text });
    return;
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // Cancelled or unsupported; fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showMessage('Copied!', 'The invite message is on your clipboard. Paste it anywhere to share.');
  } catch {
    showMessage('Share this invite', text);
  }
}
