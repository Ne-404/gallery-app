import * as DocumentPicker from 'expo-document-picker';

import type { FileKind, StoredFile } from '@/lib/local-files';

/**
 * Browser storage for imported files. They're too big for localStorage, so the bytes live
 * in IndexedDB and the stored `uri` is `idb:<id>`.
 */
// Named for the removed PDF reader; kept so imported songs aren't lost.
const DB_NAME = 'gallery-pdfs';
const STORE = 'files';
const TYPES: Record<FileKind, string> = { audio: 'audio/*' };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const keyOf = (uri: string) => uri.replace(/^idb:/, '');

export async function pickAndStore(kind: FileKind): Promise<StoredFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: TYPES[kind], multiple: true, base64: false });
  if (result.canceled) return [];
  const stored: StoredFile[] = [];
  for (const asset of result.assets) {
    if (!asset.file) continue;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await run('readwrite', (store) => store.put(asset.file as Blob, id));
    stored.push({ id, name: asset.name.replace(/\.\w+$/, ''), size: asset.size ?? asset.file.size, uri: `idb:${id}` });
  }
  return stored;
}

/** An object URL for the stored file, or the URI itself for anything else. */
export async function storedUrl(uri: string) {
  if (!uri.startsWith('idb:')) return uri;
  const blob = await run<Blob | undefined>('readonly', (store) => store.get(keyOf(uri)));
  return blob ? URL.createObjectURL(blob) : null;
}

export function deleteStored(uri: string) {
  run('readwrite', (store) => store.delete(keyOf(uri))).catch(() => {});
}
