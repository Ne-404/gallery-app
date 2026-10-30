import { AppState } from 'react-native';

import { createStore } from '@/lib/create-store';
import type { Scope } from '@/lib/scopes';
import { checkVaultPasscode, clearVaultFailures, type UserData } from '@/lib/user-data';

/**
 * Whether the vault is unlocked for this session. Never persisted: the vault locks again
 * when the app goes to the background, when you leave it, or on relaunch.
 */
const unlocked = createStore(false);

export const useVaultUnlocked = unlocked.use;

/** Tries a passcode; 'locked' means too many wrong attempts (see `vaultLockoutSeconds`). */
export function unlockVault(passcode: string) {
  const result = checkVaultPasscode(passcode);
  if (result === 'ok') unlocked.set(true);
  return result;
}

/** Opens the vault after another proof of ownership (fingerprint, or a new passcode). */
export function openVault() {
  clearVaultFailures();
  unlocked.set(true);
}
export const lockVault = () => unlocked.set(false);

AppState.addEventListener('change', (state) => {
  if (state !== 'active') lockVault();
});

/** Ids of every item in the vault. Saved items are hidden everywhere else in the app. */
export function vaultIds(data: Pick<UserData, 'collections'>) {
  return new Set(data.collections.flatMap((c) => c.items.map((e) => e.id)));
}

export function isVaultScope(scope: Scope) {
  return scope === 'saved' || scope.startsWith('collection:');
}
