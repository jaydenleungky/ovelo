// Phones: expo-sqlite provides a localStorage that survives app restarts.
// The browser version lives in auth-storage.web.ts.
import 'expo-sqlite/localStorage/install';

export const authStorage = localStorage;
