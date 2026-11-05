import { useWindowDimensions } from 'react-native';

/** Screens at least this wide (laptops, tablets in landscape) get roomier layouts. */
export const WIDE_SCREEN_WIDTH = 900;

export function useWideScreen() {
  return useWindowDimensions().width >= WIDE_SCREEN_WIDTH;
}
