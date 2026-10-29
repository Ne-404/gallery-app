import type { MediaItem } from '@/lib/media';
import type { Story } from '@/lib/user-data';

/** A story ready to play: its items resolved against the visible library. */
export type Reel = {
  id: string;
  title: string;
  subtitle: string;
  items: MediaItem[];
};

/**
 * Stories are curated by the user (not generated from dates). Items that were deleted or
 * moved to the vault are skipped; stories left empty are hidden until edited.
 */
export function buildReels(stories: Story[], itemsById: Map<string, MediaItem>) {
  return stories.flatMap((story): Reel[] => {
    const items = story.itemIds.flatMap((id) => itemsById.get(id) ?? []);
    if (items.length === 0) return [];
    return [
      {
        id: story.id,
        title: story.title,
        subtitle: `${items.length} ${items.length === 1 ? 'item' : 'items'}`,
        items,
      },
    ];
  });
}

/** The starter stories created once, the first time the library loads. */
export function starterStories(items: MediaItem[]) {
  const ids = (list: MediaItem[], max: number) => list.slice(0, max).map((i) => i.id);
  return [
    { title: 'Highlights', itemIds: ids(items.filter((i) => i.type === 'photo' && !i.burstId), 8) },
    { title: 'In motion', itemIds: ids(items.filter((i) => i.kind === 'video' || i.kind === 'live'), 10) },
  ];
}
