import { useSyncExternalStore } from 'react';

/** Minimal external store. `use()` re-renders whenever the state object is replaced. */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe,
    use: () => useSyncExternalStore(subscribe, () => state, () => state),
  };
}
