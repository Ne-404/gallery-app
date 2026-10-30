# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is **npm** (`package-lock.json`), so use `npx`, not `bunx`.

```bash
npx expo start          # dev server (add --web, or scan the QR with Expo Go)
npx tsc --noEmit        # typecheck
npx expo lint           # lint
npx expo install <pkg>  # add a dependency (SDK-compatible versions)
```

There is no test runner. Verify changes with the typecheck, lint, and by fetching the Metro bundle for each platform while the dev server runs:
`curl -o /dev/null -w "%{http_code}" "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true"` (also `ios`, `web`).

`npm run reset-project` wipes `src/app/` into `example/`. Don't run it unless asked.

Known pre-existing lint error: `react-hooks/set-state-in-effect` in `src/hooks/use-color-scheme.web.ts` (template code). Everything else should be clean.

## Constraints

- Expo SDK 58, React Native 0.88, React 19.3, TypeScript strict. Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- **React Compiler is on** (`experiments.reactCompiler`). Don't hand-write `useMemo`/`useCallback`. Mutate Reanimated shared values with `.set()`/`.get()`, not `.value`, or the compiler lint rule fails. `React.memo` is fine and used for list cells.
- **Typed routes** (`experiments.typedRoutes`): `href`s are type-checked against generated `.expo/types`. A new route only type-checks after the dev server has regenerated them.
- **Must keep working in Expo Go.** Things Expo Go can't do are feature-detected, not assumed:
  - Android media-library access: the library shows sample content and the Home banner explains why.
  - `expo-notifications`: loaded lazily, and only if `ExpoTopicSubscriptionModule` exists.
  - Face ID: Android fingerprint works.
- **Auto-rotate** (`orientation: "default"`) follows the phone's rotation lock. Size layouts from `useAppWidth()` on every render (never once at mount); full-screen pagers (viewer, stories) scroll back to their index when the page size changes.
- **Web is a client-only SPA** (`web.output: "single"`). Don't switch to `"server"`: the UI depends on window size, `localStorage` and `Date.now()`, so SSR causes hydration errors.
- **Web renders inside a phone frame** (`components/app-frame.web.tsx`). Size layouts with `useAppWidth()` (it subtracts the bezel), never `useWindowDimensions`. Web sheets portal into the frame's `overlay-host` view (`sheet.web.tsx`).
- Platform splits use `.web.ts(x)` files, e.g. `storage`, `share`, `local-files`, `device-files`, `biometrics`, `export`, `sheet`. Keep the exports of each pair identical.
- No button sounds or haptics: they were removed on request, so don't reintroduce a feedback module.

## Architecture

"Gallery" is a private, fully offline gallery: nothing is uploaded. It has an Instagram-style, Material 3 UI, with a feed, music player, videos, profile, side panel, photo editor, vault, notes and insights/challenges.

### Shell and navigation

- `src/app/_layout.tsx` nests `GestureHandlerRootView` → `AppFrame` → Stack, with the `SidePanel` drawer and `ExportHost` mounted on top. It also runs `useAppBootstrap()`, which loads media, notifications, challenge completion and the one-time starter stories.
- **Tabs** (`(tabs)`: Home `index`, `music`, Videos `reels`, `profile`) use one cross-platform floating bar, `components/app-tabs.tsx`, built on `expo-router/ui`. A new tab needs a route file and a `TABS` entry. Content scrolls under the bar, so pad scrollable content with `BottomTabInset`.
- **Gestures:**
  - A sideways pan anywhere on a tab switches tabs. Horizontal controls must call `blockSwipe()` (`lib/ui.ts`) while dragged; `Slider` does.
  - Pinch any `MediaGrid` to change its column count (ctrl+wheel on web).
  - All gestures use react-native-gesture-handler **v3 hooks** (`usePinchGesture`, `usePanGesture`, …). Their callbacks are worklets that call JS through `scheduleOnRN` from `react-native-worklets`. A function captured by a worklet must be declared before the gesture hook.
- **Side panel** open state is plain React state in the root layout (`registerSidePanel` / `openSidePanel` in `lib/ui.ts`). Don't move it to a `createStore` store: that caused "change in the order of Hooks" crashes on web.
- Use `confirmAction` (`lib/ui.ts`) for yes/no prompts, because RN Web's `Alert.alert` does nothing. Use `showToast(message, { label: 'Undo', onPress })` (`lib/toast.ts`, rendered by `ToastHost`) to confirm actions.
- Notification deep links only accept in-app paths (`/…`).

### State and derived data

- State lives in small external stores built on `lib/create-store.ts` (`useSyncExternalStore`), with no context providers.
  - `lib/media.ts` (`library`) holds media items from the SDK 58 `Query().exeForMetadata()` API. Ids are `ph://` (iOS) or `content://` (Android) and are rendered directly by `expo-image`. iOS videos must go through `resolvePlayableUri()`. Without device access the library shows sample content instead (`source: 'demo'`, `lib/demo.ts`): picsum.photos photos, public test clips and SoundHelix songs, so it needs network access. `useAppBootstrap` seeds matching notes, stories, folders, likes and songs once (`seedDemoContent`, `demoSeeded`) and removes all of it, including what the user did with it, once the real library loads (`clearDemoContent`). Sample ids start with `demo:` (media) or `demo-` (user data); keep that prefix for anything new. The first load fetches the newest 120 items (`partial: true`) so the feed appears at once, then the full library.
  - `lib/user-data.ts` (`userData`) holds everything the user creates, as one JSON blob in `lib/storage.ts` (`expo-sqlite/kv-store` on device, `localStorage` on web). All mutations are exported functions in that file. Writes are batched (400 ms) and flushed on background or `pagehide`. `load()` merges defaults, so new fields need a default in `DEFAULT_DATA` (edits go through `normalizeEdit`).
- `useGallery()` (`hooks/use-gallery.ts`) derives views once per state change and shares them across all callers (single-entry cache):
  - Virtual copies are inserted after their originals.
  - `removed` ids are dropped.
  - `library.items` excludes vault and trashed items. `scoped(scope)` reaches them for their own scopes.
  - Also returns `itemsById`, `reels` (stories), challenges, `vaultCount` and `trashCount`.
- **Scopes** (`lib/scopes.ts`) name a media list: `all`, a kind, `liked`/`saved`/`notes`/`edited`/`trash`, `year:<n>`, `collection:<id>` (vault album) or `folder:<id>`. The viewer swipes through the scope it was opened from.
- Challenge progress is computed from user-data timestamps; only `startedAt`/`completedAt` are stored.

### Photos and editing

- **Edits are non-destructive** (`lib/edits.ts`). They cover:
  - filters and adjustments; highlights, shadows and tint are approximated with blended overlays
  - rotate, flip and `straighten` (a rotation plus a zoom to cover the frame)
  - a normalized crop rect in display space: rotating resets it, flipping mirrors it
  - text layers and `drawings` (SVG strokes via react-native-svg)
- Always render photos through `components/edited-image.tsx` and pass `sourceAspect`. It only measures itself (the "precise" path) when a crop, turn, straighten, text or drawing needs it.
- **Saving in the editor creates a virtual copy** (`copyItem`; copy ids contain `#copy-`); editing a copy updates it in place. Originals are never modified.
- **Vault:** everything in a `collection` is hidden from the rest of the app behind a passcode.
  - The passcode is stored as a salted hash, iterated 3000 rounds, using `lib/sha256.ts`, a pure-JS hash, because Web Crypto is missing on plain-http LAN URLs. Old single-round hashes upgrade on unlock.
  - After 5 wrong attempts, each further miss locks entry for an escalating, persisted time (`checkVaultPasscode` returns `'ok' | 'wrong' | 'locked'`).
  - Vault items must not leak: use `isVaulted(id)` from `useGallery()` anywhere an item could surface by id (notes, attachments, avatar, editor deep links). `trash` excludes them, and deleting a vault item is permanent.
  - The vault hides photos; it doesn't encrypt them (user data is plain JSON in storage).
  - The vault is only reached from the side panel: Albums and Profile don't link to it.
  - The unlock state (`lib/vault.ts`) is session-only.
  - `album` and `viewer` redirect to `/vault` for vault scopes while it's locked.
  - Fingerprint unlock and passcode recovery come from `lib/biometrics.ts`.
- **Folders** (`folders`) are non-private albums; an item is in at most one. `components/move-picker.tsx` moves items into a folder or a vault album.
- **Multi-select** lives in `MediaGrid`: long-press a tile, then use `SelectionBar` for bulk actions.
  - Home's feed long-press and the "Select" action in the ⋯ menu (`components/item-actions.tsx`) switch Home to the grid with `initialSelected`.
  - **Delete** moves items to `trash`. **Delete forever** calls `deleteFromDevice`.
- **Sharing** uses the system share sheet. On device, edited photos are first rendered to a JPEG by `ExportHost` (react-native-view-shot, driven by `lib/export.ts`). The web share in `share.web.ts` sends original files via `navigator.share`, or downloads them.
- **Viewer:**
  - `components/zoomable.tsx` handles pinch and pan; double-tap zooms and a single tap toggles the bars.
  - A downward pan closes the viewer when not zoomed. There's also a slideshow button.
- Recently deleted is purged after `TRASH_DAYS` (30) at startup (`purgeExpiredTrash`).
  - Videos always use the built-in VLC-style controls in `video-surface.tsx` (no native controls, no other player modes). A tap anywhere on the video toggles them; the tap layer sits above the native `VideoView`, which swallows touches on Android. Videos hide the like/note/save bar. Background play (`settings.videoBackground`) needs the `expo-video` plugin's `supportsBackgroundPlayback`, so only works in a development build.
  - On web, `play()` does nothing until the `<video>` mounts and browsers may block autoplay, so `video-surface.tsx` starts web players as paused and calls `play()` after mount.
  - The viewer route exports an `ErrorBoundary`, so a failing photo or video shows "Try again" instead of crashing.
- **Home feed** is a Pinterest-style masonry: `FlashList` with `masonry` and `numColumns` (2 on phones, more on wide screens), rendering `components/pin-card.tsx`. Home's Grid view is the same masonry (`MediaGrid masonry`) at the grid's own column count, still pinchable. FlashList recycles cells, so cards keep no per-item state and images pass `recyclingKey`.
- `PinCard` and `MediaTile` are memoized and take id-based handlers. Pass stable functions (state setters), not inline closures.
- **Full-screen pagers** (viewer, stories) track the current page with `onViewableItemsChanged`, created once via `useState` (FlatList throws if it changes). Don't use `onMomentumScrollEnd`: web wheel/trackpad scrolling and slow native drags never fire it.

### Other features

- **Stories** are user-curated (`stories`: a title plus ordered `itemIds`), not generated from dates. `lib/reels.ts` resolves them, `components/stories-row.tsx` (Profile) plays or edits them, `app/stories.tsx` plays them and `app/story.tsx` edits them. The Videos tab is a grid of every video, not stories.
- **Music** (`(tabs)/music.tsx`) uses one global expo-audio player in `lib/music.ts`, so playback continues across screens. It registers lock-screen/notification controls (`setActiveForLockScreen`, which Android needs for background play). There's no next/previous there, because single players don't emit those events. `components/mini-player.tsx` shows the now-playing bar above the tab bar. Tracks are imported songs and files found on the device (no built-in samples). `components/vinyl.tsx` draws the spinning record. The big record is also the volume knob: drag up/right for louder, down/left for quieter.
- **Notes** (`app/notes.tsx`, `app/note.tsx`) merge freestanding `journal` notes with per-photo `notes` (`lib/notes.ts`). Lines starting with ☐/☑ are checklist items, • bullets and # headings.
- **Themes:**
  - `settings.appearance` is `system`, `light`, `dark`, `brutal`, `pop` (Pop Art) or `pirate` (Pirate). A saved appearance that no longer exists falls back to `system` (`use-theme.ts`).
  - Adding a theme takes a `Colors` entry, `ThemeStyles` tokens (`brutal`, `dark`, `outline`, `shadow`, `serif`, `accent`, `desk`) and an `Appearances` swatch, all in `constants/theme.ts`.
  - Read colors via `useTheme()`/`useAccent()`, never `useColorScheme()`.
  - `ThemedView type="backgroundElement"` gets outlines automatically.
  - Themes change only through the press-and-hold wheel in the side panel (`components/theme-wheel.tsx`).
- Icons go through `components/icon.tsx`, which takes an SF Symbol name plus a Material Symbol name. The names are type-checked. Web draws them from an ~8 KB subset of Material Symbols (`icon.web.tsx`), so **run `npm run icons` after adding an icon**; until then a missing one falls back to the ~1 MB full font.

### Files and platform pitfalls

- **Imported files** (songs) go through `lib/local-files.ts`.
  - **On device:** files are copied into `Paths.document/<kind>` and stored as `doc:<kind>/<file>`. Never store absolute paths, because Expo Go's documents folder can move between sessions.
  - **On web:** the bytes go into IndexedDB and are stored as `idb:<id>`.
  - **Copying:** `File.copy()` is **async** (`copySync` is the sync one). Imports use the legacy `copyAsync` first, because the new API can't read picker files in Expo Go on Android.
- **Device scanning** (`lib/device-files.ts`) covers Android media-library audio (development builds only) and folders the user picks once (`settings.musicFolder`). Found files are read in place, and `deleteStored` never deletes them.
- **react-native-web `onLayout`** only attaches when a view mounts. If a view gains `onLayout` on a later render (for example after an early return), it never fires: keep it on every branch, or remount with a `key`. Horizontal `FlatList` pages also need an explicit height on web.
- **`FlatList` with `numColumns`:** `initialNumToRender` and `maxToRenderPerBatch` count *rows*, not items. A tile count there loads the whole library at once.
- **Never `Image.prefetch` device photos:** it decodes them at full resolution (a 12 MP photo is ~48 MB in memory), which crashed the app. Rendered images are downscaled to their view instead.
