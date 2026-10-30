import { useWindowDimensions } from 'react-native';

import { FrameBezel, FrameBreakpoint, FrameWidth } from '@/constants/theme';

// Touch-first browsers (phones, tablets) use the whole screen; only a desktop with a mouse or
// trackpad shows the app inside a phone frame. Pointer type doesn't change while the page is open.
const finePointer =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: fine)').matches
    : true;

/** Whether the app is drawn inside the desktop phone frame. */
export function useFramed() {
  const { width } = useWindowDimensions();
  return finePointer && width > FrameBreakpoint;
}

/** On web the app lives in a phone-sized frame, so layouts use the frame's screen width. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  return useFramed() ? FrameWidth - FrameBezel * 2 : width;
}
