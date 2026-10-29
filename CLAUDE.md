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
  - Android media-library access: the app falls back to demo media.
  - `expo-notifications`: loaded lazily, and only if `ExpoTopicSubscriptionModule` exists.
  - Face ID: Android fingerprint works.
- **Web is a client-only SPA** (`web.output: "single"`). Don't switch to `"server"`: the UI depends on window size, `localStorage` and `Date.now()`, so SSR causes hydration errors.
- **Web renders inside a phone frame** (`components/app-frame.web.tsx`). Size layouts with `useAppWidth()` (it subtracts the bezel), never `useWindowDimensions`. Web sheets portal into the frame's `overlay-host` view (`sheet.web.tsx`).
- Platform splits use `.web.ts(x)` files, e.g. `storage`, `share`, `local-files`, `device-files`, `biometrics`, `export`, `external-player`, `pdf-view`, `sheet`. Keep the exports of each pair identical.
- No button sounds or haptics: they were removed on request, so don't reintroduce a feedback module.

## Architecture

"Gallery" is a private, fully offline gallery: nothing is uploaded. It has an Instagram-style, Material 3 UI, with a feed, music player, videos, profile, side panel, photo editor, vault, notes, a PDF reader and insights/challenges.

### Shell and navigation

- `src/app/_layout.tsx` nests `GestureHandlerRootView` → `AppFrame` → Stack, with the `SidePanel` drawer and `ExportHost` mounted on top. It also runs `useAppBootstrap()`, which loads media, notifications, challenge completion and the one-time starter stories.
- **Tabs** (`(tabs)`: Home `index`, `music`, Videos `reels`, `profile`) use one cross-platform floating bar, `components/app-tabs.tsx`, built on `expo-router/ui`. A new tab needs a route file and a `TABS` entry. Content scrolls under the bar, so pad scrollable content with `BottomTabInset`.
- **Gestures:**
  - A sideways pan anywhere on a tab switches tabs. Horizontal controls must call `blockSwipe()` (`lib/ui.ts`) while dragged; `Slider` does.
  - Pinch any `MediaGrid` to change its column count (ctrl+wheel on web).
  - All gestures use react-native-gesture-handler **v3 hooks** (`usePinchGesture`, `usePanGesture`, …). Their callbacks are worklets that call JS through `scheduleOnRN` from `react-native-worklets`. A function captured by a worklet must be declared before the gesture hook.
- **Side panel** open state is plain React state in the root layout (`registerSidePanel` / `openSidePanel` in `lib/ui.ts`). Don't move it to a `createStore` store: that caused "change in the order of Hooks" crashes on web.
- Use `confirmAction` (`lib/ui.ts`) for yes/no prompts, because RN Web's `Alert.alert` does nothing.

### State and derived data

- State lives in small external stores built on `lib/create-store.ts` (`useSyncExternalStore`), with no context providers.
  - `lib/media.ts` (`library`) holds media items from the SDK 58 `Query().exeForMetadata()` API. Ids are `ph://` (iOS) or `content://` (Android) and are rendered directly by `expo-image`. iOS videos must go through `resolvePlayableUri()`. Without device access, `demoLibrary()` builds picsum/sample-video items with dates relative to now.
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
  - The passcode is stored as a salted hash using `lib/sha256.ts`, a pure-JS hash, because Web Crypto is missing on plain-http LAN URLs.
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
  - Videos use `settings.videoPlayer`: `builtin`, `minimal`, or `external` (`lib/external-player.ts`).
- `PostCard` and `MediaTile` are memoized and take id-based handlers. Pass stable functions (state setters), not inline closures.

### Other features

- **Stories** are user-curated (`stories`: a title plus ordered `itemIds`), not generated from dates. `lib/reels.ts` resolves them, `components/stories-row.tsx` (Profile) plays or edits them, `app/stories.tsx` plays them and `app/story.tsx` edits them. The Videos tab is a grid of every video, not stories.
- **Music** (`(tabs)/music.tsx`) uses one global expo-audio player in `lib/music.ts`, so playback continues across screens. Tracks are imported songs, files found on the device and streamed samples. `components/vinyl.tsx` draws the spinning record.
- **PDF reader:** `app/pdfs.tsx` and `app/pdf.tsx`. `components/pdf-view(.web).tsx` hosts `lib/pdf-annotator-html.ts`, a pdf.js page loaded from cdnjs, so opening a PDF needs network access.
  - It runs in a WebView on device and an iframe on web, and talks to the app via postMessage.
  - Strokes are stored by `lib/pdf-annotations.ts` and the last page read in `PdfDoc.lastPage`.
  - The page is a template string, so keep inline SVG attributes single-quoted: escaped quotes break it.
- **Notes** (`app/notes.tsx`, `app/note.tsx`) merge freestanding `journal` notes with per-photo `notes` (`lib/notes.ts`). Lines starting with ☐/☑ are checklist items, • bullets and # headings.
- **Themes:**
  - `settings.appearance` is `system`, `light`, `dark`, `brutal`, `gothic` (Blood Moon) or `pop` (Pop Art).
  - Adding a theme takes a `Colors` entry, `ThemeStyles` tokens (`brutal`, `dark`, `outline`, `shadow`, `serif`, `accent`, `desk`) and an `Appearances` swatch, all in `constants/theme.ts`.
  - Read colors via `useTheme()`/`useAccent()`, never `useColorScheme()`.
  - `ThemedView type="backgroundElement"` gets outlines automatically.
  - Themes change only through the press-and-hold wheel in the side panel (`components/theme-wheel.tsx`).
- Icons go through `components/icon.tsx`, which takes an SF Symbol name plus a Material Symbol name. The names are type-checked.

### Files and platform pitfalls

- **Imported files** (PDFs, songs) go through `lib/local-files.ts`.
  - **On device:** files are copied into `Paths.document/<kind>` and stored as `doc:<kind>/<file>`. Never store absolute paths, because Expo Go's documents folder can move between sessions.
  - **On web:** the bytes go into IndexedDB and are stored as `idb:<id>`.
  - **Copying:** `File.copy()` is **async** (`copySync` is the sync one). Imports use the legacy `copyAsync` first, because the new API can't read picker files in Expo Go on Android.
- **Device scanning** (`lib/device-files.ts`) covers Android media-library audio (development builds only) and folders the user picks once (`settings.musicFolder` / `pdfFolder`). Found files are read in place, and `deleteStored` never deletes them.
- **react-native-web `onLayout`** only attaches when a view mounts. If a view gains `onLayout` on a later render (for example after an early return), it never fires: keep it on every branch, or remount with a `key`. Horizontal `FlatList` pages also need an explicit height on web.
