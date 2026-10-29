import { AppState, Platform } from 'react-native';

import type { AccentName, Appearance } from '@/constants/theme';
import { createStore } from '@/lib/create-store';
import { dayKey } from '@/lib/dates';
import { isEdited, normalizeEdit, type Edit } from '@/lib/edits';
import { sha256 } from '@/lib/sha256';
import { storage } from '@/lib/storage';

/**
 * Everything the user creates (likes, notes, collections, challenge progress, settings).
 * Persisted on-device in SQLite; nothing ever leaves the phone.
 */

export type Note = { text: string; updatedAt: number };
export type CollectionEntry = { id: string; addedAt: number };
export type Collection = { id: string; name: string; items: CollectionEntry[]; createdAt: number };
export type ChallengeProgress = { startedAt: number; completedAt?: number };
export type LibrarySource = 'device' | 'demo';
export type VideoPlayer = 'builtin' | 'minimal' | 'external';
/** A duplicate of a photo with its own edits (originals are never copied on disk). */
export type MediaCopy = { id: string; sourceId: string; createdAt: number };
/** A PDF imported into the reader. `uri` is a local file on device; web keeps the bytes in IndexedDB. */
export type PdfDoc = { id: string; name: string; size: number; addedAt: number; uri: string; lastPage?: number };
/** A regular (not private) folder of photos. A photo lives in at most one folder. */
export type Folder = { id: string; name: string; itemIds: string[]; createdAt: number; hidden?: boolean };
/** A note in the Notes app (photo notes stay in `notes`, keyed by photo). */
export type JournalNote = {
  id: string;
  title: string;
  /** Plain text; lines starting with ☐/☑ are checklist items, • bullets, # headings. */
  body: string;
  pinned: boolean;
  color: NoteColor;
  itemIds: string[];
  createdAt: number;
  updatedAt: number;
};
export type NoteColor = 'none' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
/** A song imported into the music player. */
export type Track = { id: string; title: string; artist: string; uri: string; size: number; addedAt: number };
/** A story (shown in the feed, on the profile and in Videos): photos you picked, in order. */
export type Story = { id: string; title: string; itemIds: string[]; createdAt: number };
export type Profile = {
  name: string;
  username: string;
  bio: string;
  /** Item shown as the profile picture; falls back to the top favorite. */
  avatarId?: string;
};
/**
 * The vault passcode as a salted, iterated SHA-256 hash (never the passcode itself), plus
 * wrong-attempt tracking so the 10,000 possible codes can't simply be tried one by one.
 */
export type VaultLock = {
  hash: string;
  salt: string;
  /** Hash rounds; missing on passcodes set before stretching was added (1 round). */
  iterations?: number;
  failures?: number;
  lockedUntil?: number;
};

export type Settings = {
  memoryReminders: boolean;
  challengeReminders: boolean;
  accent: AccentName;
  appearance: Appearance;
  /** Photo dates are hidden by default for privacy. */
  hideDates: boolean;
  /** How videos play: the system controls, Gallery's minimal player, or another app. */
  videoPlayer: VideoPlayer;
  /** Folders picked once and then scanned automatically (Android/iOS directory URIs). */
  musicFolder: string | null;
  pdfFolder: string | null;
  source: LibrarySource;
  /** The demo-media banner on Home was closed; Settings still explains the library source. */
  libraryBannerDismissed: boolean;
};

export type UserData = {
  likes: Record<string, number>;
  notes: Record<string, Note>;
  edits: Record<string, Edit>;
  collections: Collection[];
  challenges: Record<string, ChallengeProgress>;
  openDays: string[];
  /** Custom names given with "Rename". */
  titles: Record<string, string>;
  /** Recently deleted: item id → when it was deleted. Restorable until deleted forever. */
  trash: Record<string, number>;
  /** Items deleted forever (demo items, or device items whose removal failed). Never shown again. */
  removed: string[];
  copies: MediaCopy[];
  pdfs: PdfDoc[];
  tracks: Track[];
  folders: Folder[];
  journal: JournalNote[];
  stories: Story[];
  /** Starter stories are created once from the library, then left entirely to the user. */
  storiesSeeded: boolean;
  profile: Profile;
  /** Saved items (everything in a collection) live in the vault; null until a passcode is set. */
  vault: VaultLock | null;
  settings: Settings;
};

const STORAGE_KEY = 'user-data-v1';

const DEFAULT_DATA: UserData = {
  likes: {},
  notes: {},
  edits: {},
  collections: [],
  challenges: {},
  openDays: [],
  titles: {},
  trash: {},
  removed: [],
  copies: [],
  pdfs: [],
  tracks: [],
  folders: [],
  journal: [],
  stories: [],
  storiesSeeded: false,
  profile: { name: 'My Gallery', username: '', bio: 'Private gallery · stored only on this device' },
  vault: null,
  settings: {
    memoryReminders: false,
    challengeReminders: false,
    accent: 'classic',
    appearance: 'system',
    hideDates: true,
    videoPlayer: 'builtin',
    musicFolder: null,
    pdfFolder: null,
    source: 'device',
    libraryBannerDismissed: false,
  },
};

function load(): UserData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const saved = JSON.parse(raw) as Partial<UserData>;
    return {
      ...DEFAULT_DATA,
      ...saved,
      edits: Object.fromEntries(Object.entries(saved.edits ?? {}).map(([id, e]) => [id, normalizeEdit(e)])),
      settings: { ...DEFAULT_DATA.settings, ...saved.settings },
      profile: { ...DEFAULT_DATA.profile, ...saved.profile },
    };
  } catch {
    return DEFAULT_DATA;
  }
}

export const userData = createStore<UserData>(load());

function persist() {
  clearTimeout(persistTimer);
  persistTimer = 0;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(userData.get()));
  } catch {
    // Storage is unavailable; keep working in memory.
  }
}

// Writes are batched: serializing the whole blob on every like made rapid taps janky.
let persistTimer = 0;
userData.subscribe(() => {
  clearTimeout(persistTimer);
  persistTimer = Number(setTimeout(persist, 400));
});

/** Writes pending changes now (the app is going to the background or closing). */
export function flushUserData() {
  if (persistTimer) persist();
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') flushUserData();
});
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushUserData);
}

export const useUserData = userData.use;

/** Returns true when the item is now liked. */
export function toggleLike(itemId: string) {
  const liked = !userData.get().likes[itemId];
  userData.set((d) => {
    const likes = { ...d.likes };
    if (liked) likes[itemId] = Date.now();
    else delete likes[itemId];
    return { ...d, likes };
  });
  return liked;
}

export function setNote(itemId: string, text: string) {
  userData.set((d) => {
    const notes = { ...d.notes };
    if (text.trim()) notes[itemId] = { text: text.trim(), updatedAt: Date.now() };
    else delete notes[itemId];
    return { ...d, notes };
  });
}

export function setEdit(itemId: string, edit: Edit) {
  userData.set((d) => {
    const edits = { ...d.edits };
    if (isEdited(edit)) edits[itemId] = edit;
    else delete edits[itemId];
    return { ...d, edits };
  });
}

export function createCollection(name: string) {
  const collection: Collection = {
    id: String(Date.now()),
    name: name.trim() || 'Untitled',
    items: [],
    createdAt: Date.now(),
  };
  userData.set((d) => ({ ...d, collections: [collection, ...d.collections] }));
  return collection.id;
}

export function deleteCollection(collectionId: string) {
  userData.set((d) => ({ ...d, collections: d.collections.filter((c) => c.id !== collectionId) }));
}

/** Returns true when the item is now in the collection. */
export function toggleInCollection(collectionId: string, itemId: string) {
  const collection = userData.get().collections.find((c) => c.id === collectionId);
  const added = !collection?.items.some((e) => e.id === itemId);
  userData.set((d) => ({
    ...d,
    collections: d.collections.map((c) =>
      c.id !== collectionId
        ? c
        : {
            ...c,
            items: added
              ? [{ id: itemId, addedAt: Date.now() }, ...c.items]
              : c.items.filter((e) => e.id !== itemId),
          }
    ),
  }));
  return added;
}

export function startChallenge(challengeId: string) {
  userData.set((d) => ({
    ...d,
    challenges: { ...d.challenges, [challengeId]: { startedAt: Date.now() } },
  }));
}

export function completeChallenge(challengeId: string) {
  userData.set((d) => ({
    ...d,
    challenges: {
      ...d.challenges,
      [challengeId]: { ...d.challenges[challengeId], completedAt: Date.now() },
    },
  }));
}

export function recordAppOpen() {
  const today = dayKey(Date.now());
  if (userData.get().openDays.includes(today)) return;
  userData.set((d) => ({ ...d, openDays: [...d.openDays, today].slice(-120) }));
}

export function updateSettings(patch: Partial<Settings>) {
  userData.set((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
}

export function resetUserData() {
  userData.set({ ...DEFAULT_DATA, settings: userData.get().settings });
}

const HASH_ROUNDS = 3000;
const FREE_ATTEMPTS = 5;

/** Key stretching: each guess costs thousands of hashes instead of one. */
function hashPasscode(passcode: string, salt: string, rounds: number) {
  let hash = sha256(`${salt}:${passcode}`);
  for (let i = 1; i < rounds; i++) hash = sha256(`${hash}:${salt}`);
  return hash;
}

/** Compares without exiting early, so timing doesn't reveal how much of a hash matched. */
function sameHash(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function setVaultPasscode(passcode: string) {
  const salt = randomSalt();
  userData.set((d) => ({
    ...d,
    vault: { salt, iterations: HASH_ROUNDS, hash: hashPasscode(passcode, salt, HASH_ROUNDS) },
  }));
}

/** Seconds until another attempt is allowed (0 when not locked out). */
export function vaultLockoutSeconds() {
  const until = userData.get().vault?.lockedUntil ?? 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/**
 * Checks a passcode. After 5 wrong attempts each further miss locks entry for 30 s,
 * doubling up to an hour. Old single-round hashes are upgraded on success.
 */
export function checkVaultPasscode(passcode: string): 'ok' | 'wrong' | 'locked' {
  const vault = userData.get().vault;
  if (!vault) return 'wrong';
  if (vaultLockoutSeconds() > 0) return 'locked';
  const rounds = vault.iterations ?? 1;
  if (sameHash(hashPasscode(passcode, vault.salt, rounds), vault.hash)) {
    if (rounds < HASH_ROUNDS) setVaultPasscode(passcode);
    else clearVaultFailures();
    return 'ok';
  }
  const failures = (vault.failures ?? 0) + 1;
  const extra = failures - FREE_ATTEMPTS;
  const lockedUntil = extra > 0 ? Date.now() + Math.min(3600, 30 * 2 ** (extra - 1)) * 1000 : undefined;
  userData.set((d) => (d.vault ? { ...d, vault: { ...d.vault, failures, lockedUntil } } : d));
  return lockedUntil ? 'locked' : 'wrong';
}

/** After a successful unlock (passcode or fingerprint). */
export function clearVaultFailures() {
  userData.set((d) => (d.vault ? { ...d, vault: { ...d.vault, failures: 0, lockedUntil: undefined } } : d));
}

/**
 * Forgotten passcode: removes the lock and everything in the vault. Its items are forgotten
 * rather than returned to the library, so a reset never reveals what the vault hid.
 */
export function resetVault() {
  forgetItems(userData.get().collections.flatMap((c) => c.items.map((e) => e.id)));
  userData.set((d) => ({ ...d, vault: null, collections: [] }));
}

export function renameItem(itemId: string, title: string) {
  userData.set((d) => {
    const titles = { ...d.titles };
    if (title.trim()) titles[itemId] = title.trim();
    else delete titles[itemId];
    return { ...d, titles };
  });
}

/** Moves items to Recently deleted. */
export function trashItems(itemIds: string[]) {
  const now = Date.now();
  userData.set((d) => ({ ...d, trash: { ...d.trash, ...Object.fromEntries(itemIds.map((id) => [id, now])) } }));
}

export function restoreItems(itemIds: string[]) {
  userData.set((d) => {
    const trash = { ...d.trash };
    for (const id of itemIds) delete trash[id];
    return { ...d, trash };
  });
}

/** Forgets items for good, along with everything the app stored about them. */
export function forgetItems(itemIds: string[]) {
  const gone = new Set(itemIds);
  const without = <T,>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([id]) => !gone.has(id)));
  userData.set((d) => ({
    ...d,
    trash: without(d.trash),
    likes: without(d.likes),
    notes: without(d.notes),
    edits: without(d.edits),
    titles: without(d.titles),
    copies: d.copies.filter((c) => !gone.has(c.id)),
    collections: d.collections.map((c) => ({ ...c, items: c.items.filter((e) => !gone.has(e.id)) })),
    // Copies are simply dropped; real items are remembered so they never reappear.
    removed: [...d.removed, ...itemIds.filter((id) => !id.includes(COPY_MARK))],
  }));
}

export const COPY_MARK = '#copy-';

/** Duplicates an item; the copy starts with the original's edits. Returns the copy's id. */
export function copyItem(itemId: string) {
  const id = `${itemId.split(COPY_MARK)[0]}${COPY_MARK}${Date.now()}`;
  userData.set((d) => ({
    ...d,
    copies: [{ id, sourceId: itemId.split(COPY_MARK)[0], createdAt: Date.now() }, ...d.copies],
    edits: d.edits[itemId] ? { ...d.edits, [id]: d.edits[itemId] } : d.edits,
  }));
  return id;
}

export function addPdf(doc: PdfDoc) {
  userData.set((d) => ({ ...d, pdfs: [doc, ...d.pdfs] }));
}

export function updatePdf(pdfId: string, patch: Partial<PdfDoc>) {
  userData.set((d) => ({ ...d, pdfs: d.pdfs.map((p) => (p.id === pdfId ? { ...p, ...patch } : p)) }));
}

export function removePdf(pdfId: string) {
  userData.set((d) => ({ ...d, pdfs: d.pdfs.filter((p) => p.id !== pdfId) }));
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function createStory(title: string, itemIds: string[]) {
  const story: Story = { id: newId(), title: title.trim() || 'Story', itemIds, createdAt: Date.now() };
  userData.set((d) => ({ ...d, stories: [...d.stories, story] }));
  return story.id;
}

export function updateStory(storyId: string, patch: Partial<Omit<Story, 'id'>>) {
  userData.set((d) => ({ ...d, stories: d.stories.map((s) => (s.id === storyId ? { ...s, ...patch } : s)) }));
}

export function deleteStory(storyId: string) {
  userData.set((d) => ({ ...d, stories: d.stories.filter((s) => s.id !== storyId) }));
}

/** Creates the starter stories the first time the library loads. */
export function seedStories(stories: { title: string; itemIds: string[] }[]) {
  userData.set((d) =>
    d.storiesSeeded
      ? d
      : {
          ...d,
          storiesSeeded: true,
          stories: stories
            .filter((s) => s.itemIds.length > 0)
            .map((s, i) => ({ id: `${newId()}-${i}`, title: s.title, itemIds: s.itemIds, createdAt: Date.now() })),
        }
  );
}

export function updateProfile(patch: Partial<Profile>) {
  userData.set((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
}

export function addTracks(tracks: Track[]) {
  userData.set((d) => ({ ...d, tracks: [...d.tracks, ...tracks] }));
}

export function removeTrack(trackId: string) {
  userData.set((d) => ({ ...d, tracks: d.tracks.filter((t) => t.id !== trackId) }));
}

export function createJournalNote(patch: Partial<JournalNote> = {}) {
  const note: JournalNote = {
    id: newId(),
    title: '',
    body: '',
    pinned: false,
    color: 'none',
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...patch,
  };
  userData.set((d) => ({ ...d, journal: [note, ...d.journal] }));
  return note.id;
}

export function updateJournalNote(noteId: string, patch: Partial<Omit<JournalNote, 'id'>>, touch = true) {
  userData.set((d) => ({
    ...d,
    journal: d.journal.map((n) => (n.id === noteId ? { ...n, ...patch, ...(touch ? { updatedAt: Date.now() } : null) } : n)),
  }));
}

export function deleteJournalNote(noteId: string) {
  userData.set((d) => ({ ...d, journal: d.journal.filter((n) => n.id !== noteId) }));
}

export function createFolder(name: string) {
  const folder: Folder = { id: newId(), name: name.trim() || 'New folder', itemIds: [], createdAt: Date.now() };
  userData.set((d) => ({ ...d, folders: [...d.folders, folder] }));
  return folder.id;
}

/** Moves items into a folder, taking them out of any other folder. */
export function moveToFolder(folderId: string, itemIds: string[]) {
  const moving = new Set(itemIds);
  userData.set((d) => ({
    ...d,
    folders: d.folders.map((f) =>
      f.id === folderId
        ? { ...f, itemIds: [...itemIds, ...f.itemIds.filter((id) => !moving.has(id))] }
        : { ...f, itemIds: f.itemIds.filter((id) => !moving.has(id)) }
    ),
  }));
}

export function renameFolder(folderId: string, name: string) {
  userData.set((d) => ({ ...d, folders: d.folders.map((f) => (f.id === folderId ? { ...f, name: name.trim() || f.name } : f)) }));
}

/** Hides a folder from the Albums list (its photos stay in the gallery), or shows it again. */
export function setFolderHidden(folderId: string, hidden: boolean) {
  userData.set((d) => ({ ...d, folders: d.folders.map((f) => (f.id === folderId ? { ...f, hidden } : f)) }));
}

/** Deletes the folder only; its photos stay in the gallery. */
export function deleteFolder(folderId: string) {
  userData.set((d) => ({ ...d, folders: d.folders.filter((f) => f.id !== folderId) }));
}

/** Adds items to a vault album (no toggling, for multi-select). */
export function addToCollection(collectionId: string, itemIds: string[]) {
  userData.set((d) => ({
    ...d,
    collections: d.collections.map((c) => {
      if (c.id !== collectionId) return c;
      const have = new Set(c.items.map((e) => e.id));
      const added = itemIds.filter((id) => !have.has(id)).map((id) => ({ id, addedAt: Date.now() }));
      return { ...c, items: [...added, ...c.items] };
    }),
  }));
}

/** Likes every item (multi-select "Favorite"). */
export function likeItems(itemIds: string[]) {
  userData.set((d) => ({
    ...d,
    likes: { ...d.likes, ...Object.fromEntries(itemIds.filter((id) => !d.likes[id]).map((id) => [id, Date.now()])) },
  }));
}

export const TRASH_DAYS = 30;

/**
 * Forgets items that have sat in Recently deleted for 30 days. Device photos are only
 * hidden from the app here (deleting them needs the user's confirmation).
 */
export function purgeExpiredTrash() {
  const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000;
  const expired = Object.entries(userData.get().trash)
    .filter(([, deletedAt]) => deletedAt < cutoff)
    .map(([id]) => id);
  if (expired.length > 0) forgetItems(expired);
}
