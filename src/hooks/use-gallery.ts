import { Accents } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { challengeStatuses, unlockedRewards } from '@/lib/challenges';
import { useLibrary, type MediaItem } from '@/lib/media';
import { buildReels } from '@/lib/reels';
import { scopeItems, type Scope } from '@/lib/scopes';
import { useUserData, type UserData } from '@/lib/user-data';
import { isVaultScope, vaultIds } from '@/lib/vault';

type Library = ReturnType<typeof useLibrary>;

/** The parts of user data that decide which items exist and where they show up. */
type ItemData = Pick<UserData, 'removed' | 'copies' | 'trash' | 'collections'>;

/** Scopes whose items depend on more user data than `ItemData` (likes, notes, …). */
const readsUserData = (scope: Scope) =>
  scope === 'liked' ||
  scope === 'saved' ||
  scope === 'trash' ||
  scope === 'notes' ||
  scope === 'edited' ||
  scope.startsWith('collection:') ||
  scope.startsWith('folder:');

/**
 * The per-item work: thousands of items, several passes. It only reruns when the library or
 * `ItemData` changes, so a like, note or setting doesn't redo it.
 */
function deriveItems(fullLibrary: Library, data: ItemData) {
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
  const burstCounts = new Map<string, number>();
  for (const item of visible) {
    if (item.burstId) burstCounts.set(item.burstId, (burstCounts.get(item.burstId) ?? 0) + 1);
  }

  return {
    all,
    kept,
    visible,
    vaulted,
    library: { ...fullLibrary, items: visible },
    itemsById: new Map(all.map((i) => [i.id, i])),
    visibleById: new Map(visible.map((i) => [i.id, i])),
    burstCounts,
    itemCount: visible.filter((i) => !i.burstId || i.burstId === i.id).length,
    trashCount: all.filter((i) => data.trash[i.id] && !vaulted.has(i.id)).length,
    /** Items of scopes that only need the above, kept across user-data changes. */
    scopes: new Map<Scope, MediaItem[]>(),
  };
}

/** Everything derived from the library and user data. */
function derive(base: ReturnType<typeof deriveItems>, data: UserData) {
  const { all, kept, visible, vaulted } = base;
  const scopes = new Map<Scope, MediaItem[]>();

  return {
    library: base.library,
    data,
    itemsById: base.itemsById,
    /** How many tiles the library shows (a burst counts once): the number every screen reports. */
    itemCount: base.itemCount,
    /** Frame counts per burst id, for the badge on collapsed burst tiles. */
    burstCounts: base.burstCounts,
    vaultCount: vaulted.size,
    trashCount: base.trashCount,
    /** Whether an item is in the vault (and so must not show up anywhere else). */
    isVaulted: (id: string) => vaulted.has(id),
    /**
     * Items of a scope; vault scopes reach saved items and `trash` the deleted ones. Results
     * are cached, so the same scope returns the same array until its inputs change.
     */
    scoped: (scope: Scope) => {
      const cache = readsUserData(scope) ? scopes : base.scopes;
      let items = cache.get(scope);
      if (!items) {
        items = scopeItems(
          scope,
          scope === 'trash' ? all.filter((i) => !vaulted.has(i.id)) : isVaultScope(scope) ? kept : visible,
          data
        );
        cache.set(scope, items);
      }
      return items;
    },
    reels: buildReels(data.stories, base.visibleById),
    challenges: challengeStatuses(base.itemsById, data),
    unlocked: unlockedRewards(data),
  };
}

let itemsCache: { library: Library; data: ItemData; value: ReturnType<typeof deriveItems> } | null = null;
let cache: { base: ReturnType<typeof deriveItems>; data: UserData; value: ReturnType<typeof derive> } | null = null;

function derived(library: Library, data: UserData) {
  const prev = itemsCache?.data;
  if (
    itemsCache?.library !== library ||
    prev?.removed !== data.removed ||
    prev.copies !== data.copies ||
    prev.trash !== data.trash ||
    prev.collections !== data.collections
  ) {
    itemsCache = { library, data, value: deriveItems(library, data) };
  }
  const base = itemsCache.value;
  if (cache?.base !== base || cache.data !== data) {
    cache = { base, data, value: derive(base, data) };
  }
  return cache.value;
}

/**
 * Library + user data with the derived views most screens need. Many components call it at
 * once (root layout, side panel, the visible screens), so it's computed once per state change
 * and shared. Saved (vault) and deleted items are left out of `library.items`; `scoped()`
 * reaches them for their own scopes.
 */
export function useGallery() {
  return derived(useLibrary(), useUserData());
}

/** The accent color: the theme's own (Pop Art, Pirate) or the user's unlocked choice. */
export function useAccent() {
  const themeAccent = useTheme().accent;
  const accent = Accents[useUserData().settings.accent].color;
  return themeAccent ?? accent;
}
