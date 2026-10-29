import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';
import { Alert } from 'react-native';

/** A file imported into the app's private storage. */
export type StoredFile = { id: string; name: string; size: number; uri: string };

export type FileKind = 'pdf' | 'audio';

const TYPES: Record<FileKind, string> = { pdf: 'application/pdf', audio: 'audio/*' };
const FOLDERS: Record<FileKind, string> = { pdf: 'pdfs', audio: 'music' };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Copies a picked file into our folder. The legacy copy handles the picker's cached files
 * in Expo Go on Android, where the new File API refuses to read them ("Missing 'READ'
 * permission"); the new API is the fallback. `File.copy` is async, so it must be awaited.
 * Throws unless the copy really landed, so a failed import never leaves a broken entry.
 */
async function copyInto(source: string, target: File) {
  try {
    await copyAsync({ from: source, to: target.uri });
  } catch {
    await new File(source).copy(target);
  }
  if (!target.exists) throw new Error(`Copy of ${source} produced no file`);
}

/** Lets the user pick files and copies them into the app's documents, so they work offline. */
export async function pickAndStore(kind: FileKind): Promise<StoredFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: TYPES[kind], multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  const dir = new Directory(Paths.document, FOLDERS[kind]);
  dir.create({ idempotent: true, intermediates: true });
  const stored: StoredFile[] = [];
  let failed = 0;
  for (const asset of result.assets) {
    const id = newId();
    const extension = asset.name.match(/\.\w+$/)?.[0] ?? '';
    const fileName = `${id}${extension}`;
    try {
      await copyInto(asset.uri, new File(dir, fileName));
    } catch (error) {
      console.warn('Could not import file', asset.name, error);
      failed++;
      continue;
    }
    // Stored relative to the documents folder: its absolute path can change between
    // sessions (Expo Go scopes it per project URL), which broke saved absolute paths.
    stored.push({ id, name: asset.name.replace(/\.\w+$/, ''), size: asset.size ?? 0, uri: `doc:${FOLDERS[kind]}/${fileName}` });
  }
  if (failed > 0) {
    Alert.alert('Some files couldn’t be imported', `${failed} ${failed === 1 ? 'file' : 'files'} couldn’t be copied into the app.`);
  }
  return stored;
}

/**
 * The stored file in the current documents folder. Accepts `doc:<folder>/<name>` and the
 * absolute `file://…/<folder>/<name>` URIs saved by earlier versions (re-rooted, since that
 * folder's absolute path may have changed). Remote URLs (sample songs) pass through.
 */
function resolve(uri: string) {
  // Files found on the device (picked folders) are read in place.
  if (uri.startsWith('content://') || isDeviceFile(uri)) return new File(uri);
  const match = uri.match(/^doc:(\w+)\/(.+)$/) ?? uri.match(/\/(pdfs|music)\/([^/]+)$/);
  return match ? new File(new Directory(Paths.document, match[1]), decodeURIComponent(match[2])) : null;
}

/** A URL players and viewers can load, or null if the file is gone. */
export async function storedUrl(uri: string) {
  if (/^https?:/.test(uri)) return uri;
  const file = resolve(uri);
  return file?.exists ? file.uri : null;
}

/** The file's bytes as base64 (the PDF annotator loads documents this way), or null if gone. */
export async function storedBase64(uri: string) {
  const file = resolve(uri);
  if (!file?.exists) return null;
  try {
    return await file.base64();
  } catch {
    return null;
  }
}

const isDeviceFile = (uri: string) => uri.startsWith('file://') && !/\/(pdfs|music)\/[^/]+$/.test(uri);

/** Removes our private copy. Files found on the device are never deleted from it. */
export function deleteStored(uri: string) {
  if (uri.startsWith('content://') || isDeviceFile(uri)) return;
  try {
    const file = resolve(uri);
    if (file?.exists) file.delete();
  } catch {
    // Already gone.
  }
}
