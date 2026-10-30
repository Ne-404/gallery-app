import type { MediaItem } from '@/lib/media';
import type { Folder, JournalNote, Note, Story, Track } from '@/lib/user-data';

/**
 * Sample content shown while the camera roll isn't available (web, Expo Go on Android, or
 * no permission). Photos are online placeholders from picsum.photos, so they need a network
 * connection. Every id starts with `demo:` (media) or `demo-` (user data), so all of it can
 * be removed once real photos load (`clearDemoContent`).
 */

export const isDemoId = (id: string) => id.startsWith('demo:') || id.startsWith('demo-');

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const SIZES = {
  portrait: [1080, 1350],
  landscape: [1600, 1067],
  square: [1200, 1200],
} as const;

const photoId = (picsum: number) => `demo:photo-${picsum}`;

const PICSUM_URL = /^(https:\/\/picsum\.photos\/id\/\d+)\/(\d+)\/(\d+)$/;
/** Widths sample photos are fetched at, so cards of similar size share cached files. */
const PICSUM_WIDTHS = [240, 360, 480, 720, 1080];

/**
 * A sample photo's URL at about `pixelWidth` wide (never larger than the original), or
 * null for anything else. Device photos don't need it: expo-image loads those at view size.
 */
export function sizedDemoUri(uri: string, pixelWidth: number) {
  const match = uri.match(PICSUM_URL);
  if (!match) return null;
  const [, base, w, h] = match;
  const width = Math.min(Number(w), PICSUM_WIDTHS.find((s) => s >= pixelWidth) ?? Number(w));
  return `${base}/${width}/${Math.round((width * Number(h)) / Number(w))}`;
}

function photo(picsum: number, shape: keyof typeof SIZES, createdAt: number): MediaItem {
  const [width, height] = SIZES[shape];
  return {
    id: photoId(picsum),
    uri: `https://picsum.photos/id/${picsum}/${width}/${height}`,
    thumbUri: `https://picsum.photos/id/${picsum}/${Math.round(width / 3)}/${Math.round(height / 3)}`,
    type: 'photo',
    kind: 'single',
    createdAt,
    duration: null,
    width,
    height,
  };
}

/** Public test clips; their posters are picsum photos, since the clips don't publish any. */
const VIDEOS: { name: string; uri: string; poster: number; duration: number }[] = [
  { name: 'flower', uri: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: 1080, duration: 5 },
  { name: 'jellyfish', uri: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4', poster: 1053, duration: 10 },
  { name: 'bunny', uri: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4', poster: 1084, duration: 10 },
  { name: 'sintel', uri: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4', poster: 1081, duration: 10 },
  { name: 'city', uri: 'https://download.samplelib.com/mp4/sample-10s.mp4', poster: 1067, duration: 10 },
];

const videoId = (name: string) => `demo:video-${name}`;

function video({ name, uri, poster, duration }: (typeof VIDEOS)[number], createdAt: number): MediaItem {
  return {
    id: videoId(name),
    uri,
    thumbUri: `https://picsum.photos/id/${poster}/640/360`,
    type: 'video',
    kind: 'video',
    createdAt,
    duration,
    width: 1280,
    height: 720,
  };
}

const PHOTOS: [number, keyof typeof SIZES][] = [
  [1015, 'landscape'], [1025, 'portrait'], [292, 'landscape'], [1016, 'landscape'], [1062, 'square'],
  [1018, 'landscape'], [429, 'portrait'], [1019, 'portrait'], [1020, 'landscape'], [1021, 'square'],
  [312, 'square'], [1022, 'landscape'], [1024, 'portrait'], [1027, 'portrait'], [1028, 'landscape'],
  [488, 'landscape'], [1029, 'landscape'], [1031, 'portrait'], [1035, 'landscape'], [1036, 'landscape'],
  [493, 'portrait'], [1037, 'portrait'], [1038, 'square'], [1039, 'landscape'], [1040, 'landscape'],
  [1041, 'portrait'], [1042, 'portrait'], [1043, 'landscape'], [1044, 'landscape'], [1047, 'portrait'],
  [1049, 'square'], [1050, 'landscape'], [1051, 'portrait'], [1055, 'landscape'], [1056, 'landscape'],
  [1057, 'portrait'], [1058, 'square'], [1059, 'landscape'], [1060, 'portrait'], [1063, 'portrait'],
  [1065, 'landscape'], [1069, 'portrait'], [1074, 'square'],
];

/** Shot within a second of each other, so the library groups them as a burst. */
const BURST = [1070, 1071, 1072];

/** Newest first, spread over the last two and a half years so there are year albums. */
export const DEMO_ITEMS: MediaItem[] = (() => {
  const items = PHOTOS.map(([picsum, shape], i) => photo(picsum, shape, now - (i * 21 + 1) * DAY_MS));
  VIDEOS.forEach((v, i) => items.push(video(v, now - (i * 97 + 4) * DAY_MS)));
  const burstAt = now - 45 * DAY_MS;
  BURST.forEach((picsum, i) => items.push(photo(picsum, 'portrait', burstAt - i * 400)));
  return items.sort((a, b) => b.createdAt - a.createdAt);
})();

/** Notes, stories, folders, likes and songs that go with the sample photos. */
export function demoUserContent() {
  const at = (daysAgo: number) => now - daysAgo * DAY_MS;
  const p = photoId;

  const likes: Record<string, number> = Object.fromEntries(
    [1015, 1025, 1062, 1019, 1036, 1043, 1057, 429].map((id, i) => [p(id), at(i + 1)])
  );
  likes[videoId('jellyfish')] = at(2);

  const notes: Record<string, Note> = {
    [p(1015)]: { text: 'The river was freezing, but the light was worth it.', updatedAt: at(3) },
    [p(1025)]: { text: 'Best boy. Waited patiently for exactly two seconds.', updatedAt: at(10) },
    [p(292)]: { text: 'Grandma’s recipe, finally got it right.', updatedAt: at(40) },
  };

  const titles: Record<string, string> = {
    [p(1015)]: 'Morning on the river',
    [p(1025)]: 'Pug portrait',
    [videoId('jellyfish')]: 'Aquarium visit',
  };

  const journal: JournalNote[] = [
    {
      id: 'demo-note-trip',
      title: 'Trip ideas',
      body: '# Mountains\n• Sunrise hike\n• Cabin with a fireplace\n# Coast\n• Lighthouse walk\n• Seafood market',
      pinned: true,
      color: 'blue',
      itemIds: [p(1016), p(1018)],
      createdAt: at(30),
      updatedAt: at(2),
    },
    {
      id: 'demo-note-groceries',
      title: 'Groceries',
      body: '☑ Coffee beans\n☑ Raspberries\n☐ Honey\n☐ Fresh bread\n☐ Oat milk',
      pinned: false,
      color: 'yellow',
      itemIds: [],
      createdAt: at(5),
      updatedAt: at(1),
    },
    {
      id: 'demo-note-photo-tips',
      title: 'Photo tips',
      body: 'Shoot during golden hour.\nFill the frame.\nLook for leading lines.',
      pinned: false,
      color: 'green',
      itemIds: [],
      createdAt: at(60),
      updatedAt: at(60),
    },
  ];

  const stories: Story[] = [
    { id: 'demo-story-outdoors', title: 'Outdoors', itemIds: [p(1015), p(1016), p(1018), p(1036), p(1043)], createdAt: at(20) },
    { id: 'demo-story-friends', title: 'Furry friends', itemIds: [p(1025), p(1062), videoId('bunny')], createdAt: at(15) },
    { id: 'demo-story-food', title: 'Good food', itemIds: [p(292), p(429), p(312), p(488)], createdAt: at(8) },
  ];

  const folders: Folder[] = [
    { id: 'demo-folder-travel', name: 'Travel', itemIds: [p(1016), p(1018), p(1022), p(1039)], createdAt: at(25) },
    { id: 'demo-folder-food', name: 'Food', itemIds: [p(292), p(429), p(312), p(488), p(493)], createdAt: at(12) },
  ];

  const tracks: Track[] = [1, 2, 3, 4].map((n) => ({
    id: `demo-track-${n}`,
    title: `SoundHelix Song ${n}`,
    artist: 'SoundHelix',
    uri: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`,
    size: 0,
    addedAt: at(n),
  }));

  return { likes, notes, titles, journal, stories, folders, tracks };
}

export type DemoContent = ReturnType<typeof demoUserContent>;
