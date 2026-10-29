import { useWindowDimensions } from 'react-native';

/** Width available to the app (the whole window on device; see `use-app-width.web.ts`). */
export function useAppWidth() {
  return useWindowDimensions().width;
}
