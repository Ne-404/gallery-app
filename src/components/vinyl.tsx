import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type VinylProps = {
  size: number;
  /** Center label color. */
  color: string;
  spinning: boolean;
  /** Seconds per turn: 33⅓ rpm is ~1.8 s. */
  period?: number;
};

/** A drawn vinyl record (grooves, label, spindle hole). No album art, just the record. */
export function Vinyl({ size, color, spinning, period = 1.8 }: VinylProps) {
  const angle = useSharedValue(0);

  useEffect(() => {
    if (!spinning) {
      cancelAnimation(angle);
      return;
    }
    // Continue from wherever it stopped.
    const from = angle.get() % 360;
    angle.set(from);
    angle.set(withRepeat(withTiming(from + 360, { duration: period * 1000, easing: Easing.linear }), -1, false));
  }, [spinning, period, angle]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));
  const grooves = size > 40 ? [0.92, 0.84, 0.76, 0.68, 0.6, 0.52] : [0.78, 0.6];

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[styles.record, { width: size, height: size, borderRadius: size / 2 }, spin]}>
        {grooves.map((g) => (
          <View
            key={g}
            style={[
              styles.groove,
              { width: size * g, height: size * g, borderRadius: (size * g) / 2, borderWidth: size > 40 ? 1 : 0.6 },
            ]}
          />
        ))}
        <View style={[styles.label, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, backgroundColor: color }]}>
          {/* A mark on the label makes the rotation visible. */}
          <View style={[styles.mark, { width: size * 0.06, height: size * 0.11, top: size * 0.02 }]} />
          <View style={[styles.hole, { width: size * 0.05, height: size * 0.05, borderRadius: size * 0.025 }]} />
        </View>
      </Animated.View>
      {/* Static highlight: the sheen stays put while the record turns under it. */}
      {size > 40 && <View pointerEvents="none" style={[styles.sheen, { borderRadius: size / 2 }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  record: {
    backgroundColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groove: {
    position: 'absolute',
    borderColor: 'rgba(255,255,255,0.07)',
  },
  label: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  hole: {
    backgroundColor: '#0B0B0C',
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.08) 100%)',
  },
});
