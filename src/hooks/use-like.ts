import { useRef } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { toggleLike, userData } from '@/lib/user-data';

const DOUBLE_TAP_MS = 280;

/** Like toggling with Instagram-style double-tap and a heart burst animation. */
export function useLike() {
  const heart = useSharedValue(0);
  const lastTap = useRef({ id: '', at: 0 });
  const singleTap = useRef(0);

  const burst = () => heart.set(withSequence(withSpring(1), withTiming(0, { duration: 400 })));

  const toggle = (itemId: string) => {
    if (toggleLike(itemId)) {
      burst();
    }
  };

  /**
   * Call on every tap; a quick second tap on the same item likes it (never unlikes).
   * `onSingleTap` runs only once it's clear no second tap is coming.
   */
  const onTap = (itemId: string, onSingleTap?: () => void) => {
    const now = Date.now();
    const isDouble = lastTap.current.id === itemId && now - lastTap.current.at < DOUBLE_TAP_MS;
    lastTap.current = { id: itemId, at: now };
    clearTimeout(singleTap.current);
    if (!isDouble) {
      if (onSingleTap) singleTap.current = Number(setTimeout(onSingleTap, DOUBLE_TAP_MS));
      return false;
    }
    if (userData.get().likes[itemId]) burst();
    else toggle(itemId);
    return true;
  };

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.get(),
    transform: [{ scale: 0.6 + heart.get() * 0.6 }],
  }));

  return { toggle, onTap, heartStyle };
}
