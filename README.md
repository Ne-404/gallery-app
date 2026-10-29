# Gall.

A private, fully offline photo gallery for iOS, Android and the web, built with Expo and React Native. It has an Instagram-style, Material 3 interface, and everything you create (likes, edits, notes, albums) stays on your device. Nothing is uploaded.

## Features

- **Feed, grid and albums:** browse your camera roll as posts or a grid. Pinch to change the number of columns, and swipe between tabs.
- **Photo editor (non-destructive):**
  - filters, light and color adjustments (including highlights, shadows, tint and vignette)
  - free crop, straighten, rotate and flip
  - text, and drawing with a pen, marker or neon brush

  Saving creates an edited copy, and the original is never changed.
- **Viewer:** pinch and double-tap to zoom, swipe between photos. Videos play in the built-in player, a minimal player or another app (your choice in Settings).
- **Organize:**
  - press and hold to select photos; select all
  - move photos into folders
  - favorite, rename, copy and share (Bluetooth, AirDrop/Nearby Share and other apps)
  - Recently deleted, with restore
- **Vault:** hide photos behind a passcode, with fingerprint unlock and recovery.
- **Music player:** a turntable with a spinning record that plays imported songs, music found on the device, or sample tracks.
- **PDF reader:** read PDFs with a pencil, highlighter and eraser. It remembers your progress and can pick up PDFs from a folder automatically.
- **Notes:** a notes app with checklists, bullets, pinning, colors and photo attachments.
- **Stories and profile:** curate your own stories and edit your profile.
- **Themes:** Light, Dark, Neo-brutalism, Blood Moon and Pop Art. Press and hold the theme circle in the side menu to switch.
- **Insights and challenges:** capture streaks and weekly stats, plus challenges that unlock accent colors.

## Getting started

Requires Node.js and npm.

```bash
npm install
npx expo start
```

- **Phone:** scan the QR code with [Expo Go](https://expo.dev/go). Your phone must be on the same Wi-Fi as your computer.
- **Browser:** press `w` in the terminal, or run `npx expo start --web`. On a desktop browser the app is shown inside a phone frame.

### Expo Go vs. a development build

The app runs in Expo Go, with a few limits that a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:android` / `npx expo run:ios`) removes:

- **Android in Expo Go can't read the photo library**, so the app shows generated demo photos and videos instead. It also can't find songs automatically or show reminder notifications.
- **iOS in Expo Go doesn't support Face ID.** The vault falls back to the device passcode.

### Network use

Everything you create stays on the device. Two things are fetched from the internet:

- **Demo content:** the demo photos and sample songs (only used when real media isn't available).
- **PDF renderer:** the PDF reader loads its rendering library, [pdf.js](https://mozilla.github.io/pdf.js/), from a CDN. Your PDFs themselves are never uploaded.

## Development

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

There's no test suite. Changes are verified with the typecheck, lint, and by running the app.

The code is organized as:

- **`src/app/`:** routes ([Expo Router](https://docs.expo.dev/router/introduction/)); `(tabs)/` holds Home, Music, Videos and Profile.
- **`src/components/`:** UI components; `.web.tsx` files are the web versions.
- **`src/lib/`:** stores and logic: media library, user data, edits, vault, music, PDFs, notes, sharing.
- **`src/hooks/`:** `useGallery()`, which derives the views every screen uses, plus theme hooks.

User data is a single JSON document stored with `expo-sqlite/kv-store` on device and `localStorage` on the web.

[CLAUDE.md](CLAUDE.md) has a more detailed architecture guide.

## Tech stack

Expo SDK 58 · React Native 0.88 · React 19 (React Compiler) · TypeScript · Expo Router · Reanimated 4 · React Native Gesture Handler 3 · expo-image · expo-video · expo-audio · expo-media-library
