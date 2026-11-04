// Browsers already have localStorage, so expo-sqlite isn't needed on web.
export const authStorage = typeof window !== 'undefined' ? window.localStorage : undefined;
