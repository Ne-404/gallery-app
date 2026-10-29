import { AppState } from 'react-native';

import { createStore } from '@/lib/create-store';
import type { Scope } from '@/lib/scopes';
import { checkVaultPasscode, type UserData } from '@/lib/user-data';

/**
 * Whether the vault is unlocked for this session. Never persisted: the vault locks again
 * when the app goes to the background, when you leave it, or on relaunch.
 */
const unlocked = createStore(false);

export const useVaultUnlocked = unlocked.use;

/** Returns true when the passcode was right and the vault is now open. */
export function unlockVault(passcode: string) {
  const ok = checkVaultPasscode(passcode);
  if (ok) unlocked.set(true);
  return ok;
}

export const openVault = () => unlocked.set(true);
export const lockVault = () => unlocked.set(false);

AppState.addEventListener('change', (state) => {
  if (state !== 'active') lockVault();
});

/** Ids of every item in the vault. Saved items are hidden everywhere else in the app. */
export function vaultIds(data: UserData) {
  return new Set(data.collections.flatMap((c) => c.items.map((e) => e.id)));
}

export function isVaultScope(scope: Scope) {
  return scope === 'saved' || scope.startsWith('collection:');
}
