import { Accents } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { challengeStatuses, unlockedRewards } from '@/lib/challenges';
import { useLibrary, type MediaItem } from '@/lib/media';
import { buildReels } from '@/lib/reels';
import { scopeItems, type Scope } from '@/lib/scopes';
import { useUserData, type UserData } from '@/lib/user-data';
import { isVaultScope, vaultIds } from '@/lib/vault';

type Library = ReturnType<typeof useLibrary>;

/**
 * Everything derived from the library and user data. Many components call `useGallery()`
 * at once (root layout, side panel, the visible screens), so the result is computed once
 * per state change and shared instead of re-filtering thousands of items per caller.
 */
function derive(fullLibrary: Library, data: UserData) {
  const removed = new Set(data.removed);
  const copiesBySource = new Map<string, UserData['copies']>();
  for (const copy of data.copies) {
    copiesBySource.set(copy.sourceId, [...(copiesBySource.get(copy.sourceId) ?? []), copy]);
  }

  // Copies sit right after their original.
  const all: MediaItem[] = [];
  for (const item of fullLibrary.items) {
    if (removed.has(item.id)) continue;
    all.push(item);
    for (const copy of copiesBySource.get(item.id) ?? []) {
      all.push({ ...item, id: copy.id, burstId: undefined });
    }
  }

  const vaulted = vaultIds(data);
  const kept = all.filter((i) => !data.trash[i.id]);
  const visible = kept.filter((i) => !vaulted.has(i.id));
  const itemsById = new Map(all.map((i) => [i.id, i]));
  const library = { ...fullLibrary, items: visible };

  return {
    library,
    data,
    itemsById,
    vaultCount: vaulted.size,
    trashCount: all.length - kept.length,
    /** Items of a scope; vault scopes reach saved items and `trash` the deleted ones. */
    scoped: (scope: Scope) =>
      scopeItems(scope, scope === 'trash' ? all : isVaultScope(scope) ? kept : visible, data),
    reels: buildReels(data.stories, new Map(visible.map((i) => [i.id, i]))),
    challenges: challengeStatuses(itemsById, data),
    unlocked: unlockedRewards(data),
  };
}

let cache: { library: Library; data: UserData; value: ReturnType<typeof derive> } | null = null;

function derived(library: Library, data: UserData) {
  if (cache?.library !== library || cache.data !== data) {
    cache = { library, data, value: derive(library, data) };
  }
  return cache.value;
}

/**
 * Library + user data with the derived views most screens need. Saved (vault) and deleted
 * items are left out of `library.items`; `scoped()` reaches them for their own scopes.
 */
export function useGallery() {
  return derived(useLibrary(), useUserData());
}

/** The accent color: the theme's own (Blood Moon, Pop Art) or the user's unlocked choice. */
export function useAccent() {
  const themeAccent = useTheme().accent;
  const accent = Accents[useUserData().settings.accent].color;
  return themeAccent ?? accent;
}
