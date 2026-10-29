import type { Edit } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';

/** Browsers can't change the wallpaper, so the option isn't offered on web. */
export const canSetWallpaper = false;

export async function setAsWallpaper(_item: MediaItem, _edit?: Edit) {
  return false;
}
