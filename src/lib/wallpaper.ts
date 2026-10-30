import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { isEdited, type Edit } from '@/lib/edits';
import { renderEdited } from '@/lib/export';
import { t } from '@/lib/i18n';
import type { MediaItem } from '@/lib/media';
import { localFile } from '@/lib/share';

export const canSetWallpaper = true;

/**
 * Sets a photo as the wallpaper. Android opens the system "Set as" picker (wallpaper, lock
 * screen, contact photo…); iOS has no API for it, so the photo goes to the share sheet, where
 * "Save Image" puts it in Photos to set from there. Edited photos are exported with their edits.
 */
export async function setAsWallpaper(item: MediaItem, edit?: Edit) {
  const edited = isEdited(edit) ? await renderEdited(item, edit!) : null;
  const assetId = item.id.split('#')[0];
  const uri = edited ?? (assetId.startsWith('content://') ? assetId : await localFile(item));
  if (Platform.OS === 'android') {
    try {
      // Other apps can't read our file:// paths, only content:// ones.
      const data = uri.startsWith('file://') ? await getContentUriAsync(uri) : uri;
      // 1 = FLAG_GRANT_READ_URI_PERMISSION.
      await IntentLauncher.startActivityAsync('android.intent.action.ATTACH_DATA', {
        data,
        type: 'image/jpeg',
        flags: 1,
        extra: { mimeType: 'image/jpeg' },
      });
      return true;
    } catch {
      // No "Set as" handler, or the file can't be shared that way: fall back to the share sheet.
    }
  }
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { dialogTitle: t('Set as wallpaper'), mimeType: 'image/jpeg', UTI: 'public.jpeg' });
  return true;
}
