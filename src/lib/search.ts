import { Filters } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';
import type { UserData } from '@/lib/user-data';

const KIND_WORDS: Record<MediaItem['kind'], string> = {
  single: 'photo picture',
  burst: 'burst photo',
  live: 'live photo motion',
  video: 'video clip movie',
  screenshot: 'screenshot screen',
};

/** Searchable words for an item, built from local metadata and the user's own data. */
function haystack(item: MediaItem, data: UserData, albumNames: Map<string, string[]>) {
  const date = new Date(item.createdAt);
  const edit = data.edits[item.id];
  return [
    KIND_WORDS[item.kind],
    data.likes[item.id] ? 'liked favorite favourite love heart' : '',
    edit ? `edited ${Filters.find((f) => f.id === edit.filter)?.label ?? ''}` : '',
    data.notes[item.id] ? `note journal ${data.notes[item.id].text}` : '',
    ...(albumNames.get(item.id) ?? []),
    String(date.getFullYear()),
    date.toLocaleDateString('en', { month: 'long' }),
    date.toLocaleDateString('en', { weekday: 'long' }),
  ]
    .join(' ')
    .toLowerCase();
}

/** Every word of the query must match somewhere (prefix match per word). */
export function searchMedia(query: string, items: MediaItem[], data: UserData) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const albumNames = new Map<string, string[]>();
  for (const c of data.collections) {
    for (const e of c.items) albumNames.set(e.id, [...(albumNames.get(e.id) ?? []), c.name]);
  }

  return items.filter((item) => {
    const text = haystack(item, data, albumNames);
    return words.every((w) => text.includes(w));
  });
}
