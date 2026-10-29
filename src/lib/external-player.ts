import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { resolvePlayableUri, type MediaItem } from '@/lib/media';

/**
 * Plays a video in another app. Android opens the system "Open with" for video (VLC, MX
 * Player, Photos…); iOS hands local files to the share sheet ("Open in…") and streams in Safari.
 */
export async function openInPlayer(item: MediaItem) {
  const uri = await resolvePlayableUri(item);
  if (Platform.OS === 'android') {
    // 1 = FLAG_GRANT_READ_URI_PERMISSION, so the player can read content:// videos.
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: uri, type: 'video/*', flags: 1 });
    return;
  }
  if (/^https?:/.test(uri)) {
    await Linking.openURL(uri);
    return;
  }
  await Sharing.shareAsync(uri, { UTI: 'public.movie', mimeType: 'video/mp4' });
}
