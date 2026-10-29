import { useWindowDimensions } from 'react-native';

import { FrameBezel, FrameBreakpoint, FrameWidth } from '@/constants/theme';

/** On web the app lives in a phone-sized frame, so layouts use the frame's screen width. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  return width > FrameBreakpoint ? FrameWidth - FrameBezel * 2 : width;
}
