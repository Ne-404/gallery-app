import {
  Asset,
  AssetField,
  getPermissionsAsync,
  MediaSubtype,
  MediaType,
  Query,
  requestPermissionsAsync,
  type AssetMetadata,
} from 'expo-media-library';
import { Platform } from 'react-native';

import { createStore } from '@/lib/create-store';
import { DEMO_ITEMS } from '@/lib/demo';

/**
 * `single` is a normal photo; everything else is "volume" content (motion or multi-shot)
 * that the feed lets you filter separately.
 */
export type MediaKind = 'single' | 'burst' | 'live' | 'video' | 'screenshot';

export type MediaItem = {
  id: string;
  /** Renderable by expo-image (`ph://` on iOS, `content://` on Android). */
  uri: string;
  thumbUri: string;
  type: 'photo' | 'video';
  kind: MediaKind;
  /** Milliseconds since epoch. */
  createdAt: number;
  /** Seconds, videos only. */
  duration: number | null;
  width: number;
  height: number;
  /** Shared by every frame of a burst; the feed shows one tile per group. */
  burstId?: string;
};

export type PermissionState = 'granted' | 'limited' | 'denied' | 'undetermined' | 'unavailable';

/**
 * `demo` means the camera roll isn't connected (web, Expo Go on Android, or no permission),
 * so sample photos show instead; `none` is only the state before the first load.
 */
export type LibrarySource = 'device' | 'demo' | 'none';

export type LibraryState = {
  status: 'loading' | 'ready';
  /** Only the newest items are in so far; the rest of the library is still loading. */
  partial?: boolean;
  source: LibrarySource;
  permission: PermissionState;
  items: MediaItem[];
};

export const library = createStore<LibraryState>({
  status: 'loading',
  source: 'none',
  permission: 'undetermined',
  items: [],
});

export const useLibrary = library.use;

const MAX_ASSETS = 5000;
/** Loaded first, so the feed shows up right away while the rest of the library loads. */
const FIRST_PAGE = 120;
const BURST_GAP_MS = 1500;

const queryAssets = (limit: number) =>
  new Query()
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(limit)
    .exeForMetadata();

export async function loadLibrary() {
  library.set((s) => ({ ...s, status: 'loading' }));

  const permission = await readPermission();
  if ((permission === 'granted' || permission === 'limited')) {
    try {
      // A refresh already has items on screen, so it goes straight to the full load.
      if (library.get().items.length === 0) {
        const first = await queryAssets(FIRST_PAGE);
        const partial = first.length === FIRST_PAGE;
        library.set({ status: 'ready', source: 'device', permission, partial, items: markBursts(first.map(fromMetadata)) });
        if (!partial) return;
      }
      const metadata = await queryAssets(MAX_ASSETS);
      library.set({
        status: 'ready',
        source: 'device',
        permission,
        items: markBursts(metadata.map(fromMetadata)),
      });
      return;
    } catch (error) {
      console.warn('Could not read the media library.', error);
    }
  }

  library.set({ status: 'ready', source: 'demo', permission, items: markBursts(DEMO_ITEMS) });
}

/** Asks for photo library access and loads the camera roll if granted. */
export async function requestLibraryAccess() {
  try {
    await requestPermissionsAsync(false, ['photo', 'video']);
  } catch (error) {
    console.warn('Media library permission request failed.', error);
  }
  await loadLibrary();
}

/** A URI that expo-video can play. iOS `ph://` ids must be resolved to a file first. */
export async function resolvePlayableUri(item: MediaItem) {
  if (item.uri.startsWith('ph://')) return new Asset(item.id).getUri();
  return item.uri;
}

async function readPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const response = await getPermissionsAsync(false, ['photo', 'video']);
    if (response.accessPrivileges === 'limited') return 'limited';
    if (response.granted) return 'granted';
    return response.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    // Expo Go on Android can't grant full media library access.
    return 'unavailable';
  }
}

function fromMetadata(asset: AssetMetadata): MediaItem {
  const isVideo = asset.mediaType === MediaType.VIDEO;
  const subtypes = asset.mediaSubtypes ?? [];
  let kind: MediaKind = 'single';
  if (isVideo) kind = 'video';
  else if (subtypes.includes(MediaSubtype.LIVE_PHOTO)) kind = 'live';
  else if (
    subtypes.includes(MediaSubtype.SCREENSHOT) ||
    /screenshot/i.test(asset.filename ?? '')
  )
    kind = 'screenshot';

  return {
    id: asset.id,
    uri: asset.id,
    thumbUri: asset.id,
    type: isVideo ? 'video' : 'photo',
    kind,
    createdAt: asset.creationTime ?? asset.modificationTime ?? 0,
    duration: asset.duration,
    width: asset.width ?? 1,
    height: asset.height ?? 1,
  };
}

/** Three or more photos shot within 1.5s of each other are treated as a burst. */
function markBursts(items: MediaItem[]) {
  const result = [...items];
  let runStart = 0;
  for (let i = 1; i <= result.length; i++) {
    const continues =
      i < result.length &&
      result[i].kind === 'single' &&
      result[i - 1].kind === 'single' &&
      Math.abs(result[i - 1].createdAt - result[i].createdAt) <= BURST_GAP_MS;
    if (continues) continue;
    if (i - runStart >= 3) {
      const burstId = result[runStart].id;
      for (let j = runStart; j < i; j++) result[j] = { ...result[j], kind: 'burst', burstId };
    }
    runStart = i;
  }
  return result;
}

/**
 * Deletes device photos for good (the system asks the user to confirm). Returns false when
 * that isn't possible, e.g. no permission; callers then just hide the items.
 */
export async function deleteFromDevice(itemIds: string[]) {
  if (library.get().source !== 'device' || Platform.OS === 'web') return false;
  const ids = itemIds.filter((id) => !id.includes('#'));
  if (ids.length === 0) return false;
  try {
    await Asset.delete(ids.map((id) => new Asset(id)));
    await loadLibrary();
    return true;
  } catch (error) {
    console.warn('Could not delete from the device library.', error);
    return false;
  }
}
