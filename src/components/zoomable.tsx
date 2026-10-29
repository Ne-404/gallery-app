import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SETTLE = { duration: 220 };

type ZoomableProps = {
  width: number;
  height: number;
  children: ReactNode;
  /** Zoomed in or back to fit; the viewer locks paging while zoomed. */
  onZoomChange?: (zoomed: boolean) => void;
  onSingleTap?: () => void;
};

/**
 * Pinch to zoom (toward the fingers), drag while zoomed, and double-tap to zoom in on a spot
 * or back out. On web, double-click and ctrl/trackpad-pinch scrolling zoom too.
 */
export function Zoomable({ width, height, children, onZoomChange, onSingleTap }: ZoomableProps) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Values when the current gesture started.
  const start = useSharedValue({ scale: 1, x: 0, y: 0, focalX: 0, focalY: 0 });

  const report = (value: boolean) => {
    setZoomed(value);
    onZoomChange?.(value);
  };

  // Keeps the photo covering the screen: it can't be dragged past its own edges.
  const clamp = (value: number, s: number, size: number) => {
    'worklet';
    const limit = (size * (s - 1)) / 2;
    return Math.min(limit, Math.max(-limit, value));
  };

  const settle = () => {
    'worklet';
    if (scale.get() <= 1.02) {
      scale.set(withTiming(1, SETTLE));
      x.set(withTiming(0, SETTLE));
      y.set(withTiming(0, SETTLE));
      scheduleOnRN(report, false);
      return;
    }
    const s = Math.min(scale.get(), MAX_SCALE);
    scale.set(withTiming(s, SETTLE));
    x.set(withTiming(clamp(x.get(), s, width), SETTLE));
    y.set(withTiming(clamp(y.get(), s, height), SETTLE));
    scheduleOnRN(report, true);
  };

  const pinch = usePinchGesture({
    onActivate: (e) => {
      'worklet';
      start.set({
        scale: scale.get(),
        x: x.get(),
        y: y.get(),
        focalX: e.focalX - width / 2,
        focalY: e.focalY - height / 2,
      });
    },
    onUpdate: (e) => {
      'worklet';
      const s0 = start.get();
      const s = Math.max(0.8, Math.min(MAX_SCALE * 1.2, s0.scale * e.scale));
      // Keep the point under the fingers fixed while scaling (and follow them as they move).
      const fx = e.focalX - width / 2;
      const fy = e.focalY - height / 2;
      scale.set(s);
      x.set(fx - (s0.focalX - s0.x) * (s / s0.scale));
      y.set(fy - (s0.focalY - s0.y) * (s / s0.scale));
    },
    onDeactivate: () => {
      'worklet';
      settle();
    },
  });

  const pan = usePanGesture({
    enabled: zoomed,
    onActivate: () => {
      'worklet';
      start.set({ scale: scale.get(), x: x.get(), y: y.get(), focalX: 0, focalY: 0 });
    },
    onUpdate: (e) => {
      'worklet';
      const s0 = start.get();
      x.set(clamp(s0.x + e.translationX, scale.get(), width));
      y.set(clamp(s0.y + e.translationY, scale.get(), height));
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      'worklet';
      if (scale.get() > 1.02) {
        scale.set(withTiming(1, SETTLE));
        x.set(withTiming(0, SETTLE));
        y.set(withTiming(0, SETTLE));
        scheduleOnRN(report, false);
        return;
      }
      // Zoom so the tapped point ends up under the finger.
      const s = DOUBLE_TAP_SCALE;
      scale.set(withTiming(s, SETTLE));
      x.set(withTiming(clamp((width / 2 - e.x) * (s - 1), s, width), SETTLE));
      y.set(withTiming(clamp((height / 2 - e.y) * (s - 1), s, height), SETTLE));
      scheduleOnRN(report, true);
    },
  });

  const singleTap = useTapGesture({
    onActivate: () => {
      'worklet';
      if (onSingleTap) scheduleOnRN(onSingleTap);
    },
  });

  const taps = useExclusiveGestures(doubleTap, singleTap);
  const gesture = useSimultaneousGestures(pinch, pan, taps);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  // Trackpad pinches arrive as ctrl+wheel events in browsers.
  const webWheel =
    Platform.OS === 'web'
      ? {
          onWheel: (e: { ctrlKey: boolean; deltaY: number; preventDefault: () => void }) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const s = Math.max(1, Math.min(MAX_SCALE, scale.get() * Math.exp(-e.deltaY / 100)));
            scale.set(s);
            x.set(clamp(x.get(), s, width));
            y.set(clamp(y.get(), s, height));
            if (s > 1.02 !== zoomed) report(s > 1.02);
          },
        }
      : null;

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.frame, { width, height }]} {...webWheel}>
        <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
});
