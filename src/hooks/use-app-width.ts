import { useWindowDimensions } from 'react-native';

/** Whether the app is drawn inside the desktop phone frame (web only; see `use-app-width.web.ts`). */
export function useFramed() {
  return false;
}

/** Width available to the app (the whole window on device; see `use-app-width.web.ts`). */
export function useAppWidth() {
  return useWindowDimensions().width;
}
