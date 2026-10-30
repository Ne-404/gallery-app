import { Filters } from '@/lib/edits';
import { dateLocale, type TKey, type Translator } from '@/lib/i18n';
import type { MediaItem } from '@/lib/media';
import type { UserData } from '@/lib/user-data';

const KIND_WORDS: Record<MediaItem['kind'], TKey> = {
  single: 'photo picture',
  burst: 'burst photo',
  live: 'live photo motion',
  video: 'video clip movie',
  screenshot: 'screenshot screen',
};

/** Searchable words for an item, built from local metadata and the user's own data. */
function haystack(item: MediaItem, data: UserData, albumNames: Map<string, string[]>, t: Translator) {
  const date = new Date(item.createdAt);
  const edit = data.edits[item.id];
  const filter = edit && Filters.find((f) => f.id === edit.filter);
  const locale = dateLocale(t.language);
  // English words always match; the app language's words are added on top.
  return [
    KIND_WORDS[item.kind],
    t(KIND_WORDS[item.kind]),
    data.likes[item.id] ? `liked favorite favourite love heart ${t('liked favorite love heart')}` : '',
    edit ? `edited ${t('edited')} ${filter ? `${filter.label} ${t(filter.label)}` : ''}` : '',
    data.notes[item.id] ? `note journal ${t('note journal')} ${data.notes[item.id].text}` : '',
    data.titles[item.id] ?? '',
    ...(albumNames.get(item.id) ?? []),
    String(date.getFullYear()),
    date.toLocaleDateString('en', { month: 'long' }),
    date.toLocaleDateString('en', { weekday: 'long' }),
    date.toLocaleDateString(locale, { month: 'long' }),
    date.toLocaleDateString(locale, { weekday: 'long' }),
  ]
    .join(' ')
    .toLocaleLowerCase(locale);
}

/** Every word of the query must match somewhere (prefix match per word). */
export function searchMedia(query: string, items: MediaItem[], data: UserData, t: Translator) {
  const words = query.toLocaleLowerCase(dateLocale(t.language)).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const albumNames = new Map<string, string[]>();
  for (const c of data.collections) {
    for (const e of c.items) albumNames.set(e.id, [...(albumNames.get(e.id) ?? []), c.name]);
  }
  for (const f of data.folders) {
    for (const id of f.itemIds) albumNames.set(id, [...(albumNames.get(id) ?? []), f.name]);
  }

  return items.filter((item) => {
    const text = haystack(item, data, albumNames, t);
    return words.every((w) => text.includes(w));
  });
}
