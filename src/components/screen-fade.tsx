import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const FADE_HEIGHT = 280;

/**
 * The sky blue that fades into the page at the top of a screen. Put it first
 * inside the screen's container so the content scrolls over it.
 */
export function ScreenFade() {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={[theme.sky, theme.background]}
      style={styles.fade}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
});
