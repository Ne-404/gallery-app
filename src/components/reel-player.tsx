import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { VideoSurface } from '@/components/video-surface';
import { Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/dates';
import type { Reel } from '@/lib/reels';

const PHOTO_MS = 3000;
const MAX_VIDEO_MS = 12000;

type ReelPlayerProps = {
  reel: Reel;
  active: boolean;
  height: number;
  cinematic: boolean;
  topInset: number;
  bottomInset: number;
  hideDates: boolean;
  footer?: React.ReactNode;
};

/** Story-style slideshow: photos get a slow Ken Burns zoom, videos play inline. */
export function ReelPlayer({
  reel,
  active,
  height,
  cinematic,
  topInset,
  bottomInset,
  hideDates,
  footer,
}: ReelPlayerProps) {
  const [rawIndex, setIndex] = useState(0);
  // The reel can shrink while playing (e.g. un-liking from Favorites).
  const index = rawIndex % reel.items.length;
  const item = reel.items[index];
  const zoom = useSharedValue(1);
  const progress = useSharedValue(0);
  const duration = item.type === 'video' ? MAX_VIDEO_MS : PHOTO_MS * (cinematic ? 1.5 : 1);

  const next = () => setIndex((index + 1) % reel.items.length);
  const previous = () => setIndex(Math.max(0, index - 1));

  useEffect(() => {
    zoom.set(1);
    progress.set(0);
    if (!active) return;
    zoom.set(withTiming(cinematic ? 1.2 : 1.1, { duration, easing: Easing.linear }));
    progress.set(withTiming(1, { duration, easing: Easing.linear }));
    const timer = setTimeout(next, duration);
    return () => {
      clearTimeout(timer);
      cancelAnimation(zoom);
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, duration, cinematic]);

  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={[styles.page, { height }]}>
      {item.type === 'video' && active ? (
        <VideoSurface key={item.id} item={item} contentFit="cover" muted onEnd={next} />
      ) : (
        <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
          <Image
            // Full-screen for a few seconds: the feed-sized preview is plenty and loads far faster.
            source={{ uri: item.previewUri ?? item.uri }}
            placeholder={{ uri: item.thumbUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={400}
          />
        </Animated.View>
      )}

      {cinematic && (
        <>
          <View style={[styles.letterbox, styles.letterboxTop]} />
          <View style={[styles.letterbox, styles.letterboxBottom]} />
        </>
      )}

      <View style={styles.tapZones}>
        <Pressable style={styles.tapPrevious} onPress={previous} />
        <Pressable style={styles.tapNext} onPress={next} />
      </View>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.segments, { paddingTop: topInset + Spacing.two }]}>
          {reel.items.map((entry, i) => (
            <View key={entry.id} style={styles.segment}>
              {i < index && <View style={[styles.segmentFill, { width: '100%' }]} />}
              {i === index && <Animated.View style={[styles.segmentFill, progressStyle]} />}
            </View>
          ))}
        </View>

        <View
          style={[styles.caption, { paddingBottom: bottomInset + Spacing.three }]}
          pointerEvents="box-none">
          <ThemedText type="subtitle" style={styles.light}>
            {reel.title}
          </ThemedText>
          <ThemedText type="small" style={styles.light}>
            {reel.subtitle}
            {hideDates ? '' : ` · ${formatDate(item.createdAt)}`}
          </ThemedText>
          {footer}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  letterbox: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '9%',
    backgroundColor: '#000',
  },
  letterboxTop: {
    top: 0,
  },
  letterboxBottom: {
    bottom: 0,
  },
  tapZones: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  tapPrevious: {
    flex: 1,
  },
  tapNext: {
    flex: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  caption: {
    padding: Spacing.three,
    gap: Spacing.one,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  light: {
    color: '#fff',
  },
});
