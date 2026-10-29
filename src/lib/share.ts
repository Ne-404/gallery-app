import { Asset } from 'expo-media-library';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { isEdited, type Edit } from '@/lib/edits';
import { renderEdited } from '@/lib/export';
import type { MediaItem } from '@/lib/media';

/** A local file for the item: demo media is downloaded, device assets resolved. */
export async function localFile(item: MediaItem) {
  const uri = item.uri;
  if (uri.startsWith('http')) {
    const folder = new Directory(Paths.cache, 'share');
    folder.create({ idempotent: true, intermediates: true });
    const name = `${item.id.replace(/[^\w-]/g, '_')}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
    const target = new File(folder, name);
    if (!target.exists) await File.downloadFileAsync(uri, target);
    return target.uri;
  }
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
    dialogTitle: 'Share via',
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

/** Shares any local file (used for PDFs). */
export async function shareFile(uri: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  return true;
}
