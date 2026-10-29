import type { Edit } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';

/** Browsers can't snapshot cross-origin photos, so the web build shares originals. */
export async function renderEdited(_item: MediaItem, _edit: Edit): Promise<string | null> {
  return null;
}
