import { Asset } from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { isEdited, type Edit } from '@/lib/edits';
import { renderEdited } from '@/lib/export';
import { t } from '@/lib/i18n';
import type { MediaItem } from '@/lib/media';

/** A local file for the item: iOS `ph://` assets are resolved to a file. */
export async function localFile(item: MediaItem) {
  const uri = item.uri;
  if (uri.startsWith('ph://')) return new Asset(item.id.split('#')[0]).getUri();
  return uri;
}

/**
 * Opens the system share sheet (Bluetooth, Nearby Share/AirDrop, messaging and other apps,
 * Save to Files…). Edited photos are exported with their edits applied first.
 * Returns false when sharing isn't possible here.
 */
export async function shareItem(item: MediaItem, edit?: Edit) {
  if (!(await Sharing.isAvailableAsync())) return false;
  const edited = item.type === 'photo' && isEdited(edit) ? await renderEdited(item, edit!) : null;
  const uri = edited ?? (await localFile(item));
  await Sharing.shareAsync(uri, {
    dialogTitle: t('Share via'),
    mimeType: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
    UTI: item.type === 'video' ? 'public.mpeg-4' : 'public.jpeg',
  });
  return true;
}

/** Shares several items. The system sheet takes one file at a time, so they follow in turn. */
export async function shareItems(items: MediaItem[], edits: Record<string, Edit>) {
  for (const item of items) {
    if (!(await shareItem(item, edits[item.id]))) return false;
  }
  return true;
}
