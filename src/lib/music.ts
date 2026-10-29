import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { createStore } from '@/lib/create-store';
import { AUDIO_FILES, canScanDevice, listFolder, pickFolder, scanAudioLibrary } from '@/lib/device-files';
import { deleteStored, pickAndStore, storedUrl } from '@/lib/local-files';
import { addTracks, removeTrack, updateSettings, userData, type Track } from '@/lib/user-data';

/** Sample songs so the player works before anything is imported (streamed, not stored). */
export const SAMPLE_TRACKS: Track[] = [1, 2, 3].map((n) => ({
  id: `sample-${n}`,
  title: `Sample song ${n}`,
  artist: 'SoundHelix',
  uri: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`,
  size: 0,
  addedAt: 0,
}));

/** Songs found on the device (media library or the chosen folder); re-scanned on open. */
const detected = createStore<{ tracks: Track[]; scanning: boolean }>({ tracks: [], scanning: false });
export const useDetectedTracks = detected.use;

export async function scanDeviceMusic() {
  if (!canScanDevice || detected.get().scanning) return;
  detected.set((d) => ({ ...d, scanning: true }));
  const folder = userData.get().settings.musicFolder;
  const files = [...(await scanAudioLibrary()), ...(folder ? listFolder(folder, AUDIO_FILES) : [])];
  const seen = new Set<string>();
  const tracks = files
    .filter((f) => !seen.has(f.uri) && !!seen.add(f.uri))
    .map((f) => ({ id: `device:${f.uri}`, title: f.name, artist: 'On this device', uri: f.uri, size: f.size, addedAt: 0 }));
  detected.set({ tracks, scanning: false });
}

/** Picks the folder to scan for songs (Downloads, Music…), then scans it. */
export async function chooseMusicFolder() {
  const uri = await pickFolder();
  if (!uri) return;
  updateSettings({ musicFolder: uri });
  await scanDeviceMusic();
}

export const allTracks = () => [...userData.get().tracks, ...detected.get().tracks, ...SAMPLE_TRACKS];

type MusicState = {
  currentId: string | null;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
};

const music = createStore<MusicState>({
  currentId: null,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: false,
});

export const useMusic = music.use;

/** One player for the whole app, so music keeps playing while you browse. */
let player: AudioPlayer | null = null;
let objectUrl: string | null = null;

function getPlayer() {
  if (player) return player;
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(
    () => {}
  );
  player = createAudioPlayer(null, { updateInterval: 500 });
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      if (music.get().repeat) {
        player?.seekTo(0);
        player?.play();
      } else {
        next();
      }
      return;
    }
    music.set((s) => ({
      ...s,
      playing: status.playing,
      loading: status.playing ? false : s.loading && !status.isLoaded,
      position: status.currentTime,
      duration: status.duration || s.duration,
    }));
  });
  return player;
}

export async function playTrack(track: Track) {
  const p = getPlayer();
  music.set((s) => ({ ...s, currentId: track.id, playing: true, loading: true, position: 0, duration: 0 }));
  const url = await storedUrl(track.uri);
  if (!url) {
    // The file is gone (e.g. removed outside the app); don't leave the player spinning.
    music.set((s) => ({ ...s, playing: false, loading: false }));
    return;
  }
  if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
  objectUrl = url;
  p.replace({ uri: url });
  p.play();
}

export function togglePlay() {
  const { currentId, playing } = music.get();
  if (!currentId) {
    const first = allTracks()[0];
    if (first) playTrack(first);
    return;
  }
  const p = getPlayer();
  if (playing) p.pause();
  else p.play();
  music.set((s) => ({ ...s, playing: !playing }));
}

function step(direction: 1 | -1) {
  const tracks = allTracks();
  if (tracks.length === 0) return;
  const { currentId, shuffle } = music.get();
  const index = tracks.findIndex((t) => t.id === currentId);
  const nextIndex = shuffle
    ? Math.floor(Math.random() * tracks.length)
    : (index + direction + tracks.length) % tracks.length;
  playTrack(tracks[nextIndex]);
}

export const next = () => step(1);

/** Restarts the song if it's a few seconds in, like every music player. */
export function previous() {
  if (music.get().position > 3) seek(0);
  else step(-1);
}

export function seek(seconds: number) {
  getPlayer().seekTo(seconds);
  music.set((s) => ({ ...s, position: seconds }));
}

export const toggleShuffle = () => music.set((s) => ({ ...s, shuffle: !s.shuffle }));
export const toggleRepeat = () => music.set((s) => ({ ...s, repeat: !s.repeat }));

export async function importSongs() {
  const files = await pickAndStore('audio');
  addTracks(
    files.map((f) => ({ id: f.id, title: f.name, artist: 'My music', uri: f.uri, size: f.size, addedAt: Date.now() }))
  );
  return files.length;
}

export function deleteSong(track: Track) {
  if (music.get().currentId === track.id) {
    player?.pause();
    music.set((s) => ({ ...s, currentId: null, playing: false, position: 0, duration: 0 }));
  }
  deleteStored(track.uri);
  removeTrack(track.id);
}
