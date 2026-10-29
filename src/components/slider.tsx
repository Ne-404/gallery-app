import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { blockSwipe } from '@/lib/ui';

type SliderProps = {
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (value: number) => void;
};

const THUMB = 22;

/** Dependency-free slider using the responder system (works on device and web). */
export function Slider({ value, min, max, color, onChange }: SliderProps) {
  const theme = useTheme();
  const track = useRef<ComponentRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const left = useRef(0);

  const fraction = (value - min) / (max - min);
  const zero = (0 - min) / (max - min);

  const update = (e: GestureResponderEvent) => {
    if (!width) return;
    const ratio = Math.min(1, Math.max(0, (e.nativeEvent.pageX - left.current) / width));
    onChange(Number((min + ratio * (max - min)).toFixed(2)));
  };

  return (
    <View
      ref={track}
      style={styles.hitArea}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        blockSwipe(60_000);
        const pageX = e.nativeEvent.pageX;
        track.current?.measureInWindow((x) => {
          left.current = x;
          update({ nativeEvent: { pageX } } as GestureResponderEvent);
        });
      }}
      onResponderMove={update}
      onResponderRelease={() => blockSwipe()}
      onResponderTerminate={() => blockSwipe()}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              left: `${Math.min(zero, fraction) * 100}%`,
              width: `${Math.abs(fraction - zero) * 100}%`,
            },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.thumb, { left: fraction * width - THUMB / 2, backgroundColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
});
