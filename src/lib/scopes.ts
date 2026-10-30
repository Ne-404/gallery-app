import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import type { TKey, Translator } from '@/lib/i18n';
import type { MediaItem, MediaKind } from '@/lib/media';
import type { UserData } from '@/lib/user-data';

/**
 * A scope names a list of media (feed filter, smart album, year or collection) so the
 * viewer can be opened on any item and swipe through the same list the user came from.
 */
export type FeedFilter = 'all' | 'photo' | MediaKind;
export type Scope =
  | FeedFilter
  | 'liked'
  | 'saved'
  | 'notes'
  | 'edited'
  | 'trash'
  | `year:${number}`
  | `collection:${string}`
  | `folder:${string}`;

export function scopeItems(scope: Scope, items: MediaItem[], data: UserData): MediaItem[] {
  if (scope === 'liked') {
    return items.filter((i) => data.likes[i.id]).sort((a, b) => data.likes[b.id] - data.likes[a.id]);
  }
  if (scope === 'saved') {
    const saved = new Set(data.collections.flatMap((c) => c.items.map((e) => e.id)));
    return items.filter((i) => saved.has(i.id));
  }
  if (scope === 'trash') {
    return items.filter((i) => data.trash[i.id]).sort((a, b) => data.trash[b.id] - data.trash[a.id]);
  }
  if (scope === 'notes') return items.filter((i) => data.notes[i.id]);
  if (scope === 'edited') return items.filter((i) => data.edits[i.id]);
  if (scope.startsWith('year:')) {
    const year = Number(scope.slice(5));
    return items.filter((i) => new Date(i.createdAt).getFullYear() === year);
  }
  if (scope.startsWith('collection:')) {
    const collection = data.collections.find((c) => `collection:${c.id}` === scope);
    const byId = new Map(items.map((i) => [i.id, i]));
    return (collection?.items ?? []).flatMap((e) => byId.get(e.id) ?? []);
  }
  if (scope.startsWith('folder:')) {
    const folder = data.folders.find((f) => `folder:${f.id}` === scope);
    const byId = new Map(items.map((i) => [i.id, i]));
    return (folder?.itemIds ?? []).flatMap((id) => byId.get(id) ?? []);
  }
  if (scope === 'all') {
    // One tile per burst; the Bursts album shows every frame.
    return items.filter((i) => !i.burstId || i.burstId === i.id);
  }
  if (scope === 'photo') return items.filter((i) => i.type === 'photo');
  return items.filter((i) => i.kind === scope);
}

export type Album = {
  scope: Scope;
  title: string;
  items: MediaItem[];
  icon: { ios: SFSymbol; android: AndroidSymbol };
};

const SMART_ALBUMS: (Omit<Album, 'items' | 'title'> & { title: TKey })[] = [
  { scope: 'liked', title: 'Favorites', icon: { ios: 'heart.fill', android: 'favorite' } },
  { scope: 'video', title: 'Videos', icon: { ios: 'video.fill', android: 'videocam' } },
  { scope: 'live', title: 'Live Photos', icon: { ios: 'livephoto', android: 'motion_photos_on' } },
  { scope: 'burst', title: 'Bursts', icon: { ios: 'square.stack.3d.down.right', android: 'burst_mode' } },
  { scope: 'screenshot', title: 'Screenshots', icon: { ios: 'camera.viewfinder', android: 'screenshot' } },
  { scope: 'edited', title: 'Edited', icon: { ios: 'wand.and.stars', android: 'auto_fix_high' } },
  { scope: 'notes', title: 'Journal', icon: { ios: 'text.bubble.fill', android: 'chat_bubble' } },
];

export function buildAlbums(items: MediaItem[], data: UserData, t: Translator) {
  const yearAlbums = [...new Set(items.map((i) => new Date(i.createdAt).getFullYear()))]
    .sort((a, b) => b - a)
    .map(
      (year): Album => ({
        scope: `year:${year}`,
        title: String(year),
        items: scopeItems(`year:${year}`, items, data),
        icon: { ios: 'calendar', android: 'calendar_month' },
      })
    );

  return {
    folders: data.folders.map(
      (f): Album => ({
        scope: `folder:${f.id}`,
        title: f.name,
        items: scopeItems(`folder:${f.id}`, items, data),
        icon: { ios: 'folder.fill', android: 'folder' },
      })
    ),
    collections: data.collections.map(
      (c): Album => ({
        scope: `collection:${c.id}`,
        title: c.name,
        items: scopeItems(`collection:${c.id}`, items, data),
        icon: { ios: 'rectangle.stack.fill', android: 'photo_library' },
      })
    ),
    smart: SMART_ALBUMS.map((a) => ({ ...a, title: t(a.title), items: scopeItems(a.scope, items, data) })).filter(
      (a) => a.items.length > 0 || a.scope === 'liked'
    ),
    years: yearAlbums,
  };
}

export function scopeTitle(scope: Scope, data: UserData, t: Translator) {
  if (scope.startsWith('year:')) return scope.slice(5);
  if (scope.startsWith('collection:')) {
    return data.collections.find((c) => `collection:${c.id}` === scope)?.name ?? t('Album');
  }
  if (scope.startsWith('folder:')) {
    return data.folders.find((f) => `folder:${f.id}` === scope)?.name ?? t('Folder');
  }
  if (scope === 'saved') return t('Saved');
  if (scope === 'trash') return t('Recently deleted');
  if (scope === 'all') return t('All photos');
  const smart = SMART_ALBUMS.find((a) => a.scope === scope);
  return smart ? t(smart.title) : t('Photos');
}
