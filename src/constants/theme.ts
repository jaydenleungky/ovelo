/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Sky, white and coral glow: white and sky blue neutrals with one bold coral
// accent that glows into amber. Text links and delete actions are red.
export const Colors = {
  light: {
    text: '#0B2540',
    background: '#FFFFFF',
    backgroundElement: '#E7F3FC',
    backgroundSelected: '#D3E6F4',
    textSecondary: '#516277',
    border: '#D3E6F4',
    tint: '#E8562A',
    /** Where the coral glow fades to, e.g. on main buttons. */
    tintEnd: '#F59E0B',
    onTint: '#FFFFFF',
    /** Text links, e.g. "Change" and "Edit". */
    link: '#E0161B',
    /** The sky blue that fades into the page at the top of each screen. */
    sky: '#BFE1F8',
    danger: '#E0161B',
  },
  dark: {
    text: '#F4F8FC',
    background: '#0B1A2A',
    backgroundElement: '#16293E',
    backgroundSelected: '#1D3D60',
    textSecondary: '#A9B8C8',
    border: '#26405C',
    tint: '#FF7F50',
    tintEnd: '#FFB347',
    onTint: '#2A0E04',
    link: '#FF4D4F',
    sky: '#1D3D60',
    danger: '#FF4D4F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
