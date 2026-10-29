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
import { DAY_MS } from '@/lib/dates';
import { updateSettings, userData, type LibrarySource } from '@/lib/user-data';

/**
 * `single` is a normal photo; everything else is "volume" content (motion or multi-shot)
 * that the feed lets you filter separately.
 */
export type MediaKind = 'single' | 'burst' | 'live' | 'video' | 'screenshot';

export type MediaItem = {
  id: string;
  /** Renderable by expo-image (`ph://` on iOS, `content://` on Android, https for demo). */
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

type LibraryState = {
  status: 'loading' | 'ready';
  source: LibrarySource;
  permission: PermissionState;
  items: MediaItem[];
};

export const library = createStore<LibraryState>({
  status: 'loading',
  source: 'demo',
  permission: 'undetermined',
  items: [],
});

export const useLibrary = library.use;

const MAX_ASSETS = 5000;
const BURST_GAP_MS = 1500;

export async function loadLibrary() {
  library.set((s) => ({ ...s, status: 'loading' }));

  const permission = await readPermission();
  const wantsDevice = userData.get().settings.source === 'device';

  if (wantsDevice && (permission === 'granted' || permission === 'limited')) {
    try {
      const metadata = await new Query()
        .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(MAX_ASSETS)
        .exeForMetadata();
      library.set({
        status: 'ready',
        source: 'device',
        permission,
        items: markBursts(metadata.map(fromMetadata)),
      });
      return;
    } catch (error) {
      console.warn('Could not read the media library, falling back to demo media.', error);
    }
  }

  library.set({ status: 'ready', source: 'demo', permission, items: markBursts(demoLibrary()) });
}

/** Asks for photo library access and switches to device media if granted. */
export async function requestLibraryAccess() {
  try {
    await requestPermissionsAsync(false, ['photo', 'video']);
  } catch (error) {
    console.warn('Media library permission request failed.', error);
  }
  updateSettings({ source: 'device' });
  await loadLibrary();
}

export async function switchToDemoLibrary() {
  updateSettings({ source: 'demo' });
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

// ---------------------------------------------------------------------------
// Demo media, used when the device library isn't available (web, Expo Go on
// Android, or permission denied). Dates are generated relative to today so
// "On This Day" memories and weekly insights always have something to show.
// ---------------------------------------------------------------------------

const DEMO_VIDEOS = [
  { url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: 152, duration: 5 },
  { url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4', poster: 1053, duration: 10 },
  { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', poster: 1043, duration: 10 },
  { url: 'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4', poster: 1036, duration: 10 },
  { url: 'https://download.samplelib.com/mp4/sample-10s.mp4', poster: 1039, duration: 10 },
];

function demoLibrary(): MediaItem[] {
  const now = Date.now();
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const yearsAgo = (years: number, dayJitter: number) => {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - years);
    return d.getTime() + dayJitter * DAY_MS;
  };

  const dates: number[] = [];
  // Recent activity, weighted toward weekends.
  for (let i = 0; i < 34; i++) {
    let t = now - random() * 28 * DAY_MS;
    const day = new Date(t).getDay();
    if (day !== 0 && day !== 6 && random() < 0.5) t -= ((day + 1) % 7) * DAY_MS;
    dates.push(Math.min(t, now - 60_000));
  }
  // This week in previous years.
  for (const years of [1, 2, 3]) {
    for (let i = 0; i < 6; i++) dates.push(yearsAgo(years, (random() - 0.5) * 5));
  }
  // Everything else spread over three years.
  while (dates.length < 92) dates.push(now - (30 + random() * 1060) * DAY_MS);

  const photos: MediaItem[] = dates.map((createdAt, i) => {
    const id = i < 86 ? i : 1020 + (i - 86);
    return {
      id: `demo-photo-${id}`,
      uri: `https://picsum.photos/id/${id}/1080/1440`,
      thumbUri: `https://picsum.photos/id/${id}/360/360`,
      type: 'photo',
      kind: i % 13 === 5 ? 'live' : 'single',
      createdAt,
      duration: null,
      width: 1080,
      height: 1440,
    };
  });

  // A burst: four frames a fraction of a second apart.
  const burstStart = now - 3 * DAY_MS;
  for (let i = 0; i < 4; i++) {
    const id = 1010 + i;
    photos.push({
      id: `demo-burst-${i}`,
      uri: `https://picsum.photos/id/${id}/1080/1440`,
      thumbUri: `https://picsum.photos/id/${id}/360/360`,
      type: 'photo',
      kind: 'single',
      createdAt: burstStart + i * 400,
      duration: null,
      width: 1080,
      height: 1440,
    });
  }

  const videoDates = [now - 2 * DAY_MS, now - 9 * DAY_MS, yearsAgo(1, 1), yearsAgo(2, -1), now - 200 * DAY_MS];
  const videos: MediaItem[] = DEMO_VIDEOS.map((video, i) => ({
    id: `demo-video-${i}`,
    uri: video.url,
    thumbUri: `https://picsum.photos/id/${video.poster}/360/360`,
    type: 'video',
    kind: 'video',
    createdAt: videoDates[i],
    duration: video.duration,
    width: 1280,
    height: 720,
  }));

  return [...photos, ...videos].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Deletes device photos for good (the system asks the user to confirm). Returns false when
 * that isn't possible, e.g. demo media or no permission; callers then just hide the items.
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
