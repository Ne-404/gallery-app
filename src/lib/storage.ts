import Storage from 'expo-sqlite/kv-store';

/** Synchronous key-value storage backed by SQLite on device (see `storage.web.ts`). */
export const storage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
};
