/** Web uses localStorage; expo-sqlite on web needs WASM bundling and COOP/COEP headers. */
export const storage = {
  getItem: (key: string) =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
};
