import type { MediaItem } from '@/lib/media';

/** In the browser "another app" is the browser's own player, in a new tab. */
export async function openInPlayer(item: MediaItem) {
  window.open(item.uri, '_blank');
}
