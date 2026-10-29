import { Directory, File } from 'expo-file-system';
import { AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';
import { Platform } from 'react-native';

/** Whether this platform can find files on its own (not in the browser). */
export const canScanDevice = true;

export type DeviceFile = { name: string; uri: string; size: number };

const AUDIO = /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i;

/**
 * Every song in the Android media library (iOS doesn't share its music library with apps).
 * Needs a development build; Expo Go can't grant that access, so this returns [] there.
 */
export async function scanAudioLibrary(): Promise<DeviceFile[]> {
  if (Platform.OS !== 'android') return [];
  try {
    const permission = await requestPermissionsAsync(false, ['audio']);
    if (!permission.granted) return [];
    const assets = await new Query().within(AssetField.MEDIA_TYPE, [MediaType.AUDIO]).limit(2000).exeForMetadata();
    return assets.map((a) => ({ name: (a.filename ?? 'Song').replace(/\.\w+$/, ''), uri: a.id, size: 0 }));
  } catch {
    return [];
  }
}

/** Asks the user to pick a folder once; it's then scanned automatically. */
export async function pickFolder() {
  try {
    return (await Directory.pickDirectoryAsync()).uri;
  } catch {
    return null;
  }
}

/** Files in a picked folder (and its subfolders) whose names match `pattern`. */
export function listFolder(folderUri: string, pattern: RegExp, depth = 3): DeviceFile[] {
  const found: DeviceFile[] = [];
  const walk = (dir: Directory, level: number) => {
    for (const entry of dir.list()) {
      if (entry instanceof Directory) {
        if (level < depth) walk(entry, level + 1);
      } else if (entry instanceof File && pattern.test(entry.name)) {
        found.push({ name: entry.name.replace(/\.\w+$/, ''), uri: entry.uri, size: entry.size ?? 0 });
      }
    }
  };
  try {
    walk(new Directory(folderUri), 0);
  } catch (error) {
    console.warn('Could not read folder', error);
  }
  return found;
}

export const AUDIO_FILES = AUDIO;
export const PDF_FILES = /\.pdf$/i;
