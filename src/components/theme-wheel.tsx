import { useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Appearances, type Appearance } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { updateSettings, useUserData } from '@/lib/user-data';

const RADIUS = 100;
const ITEM = 58;
const HOLD_MS = 280;
/** How far the finger has to slide before a theme is highlighted. */
const DEAD_ZONE = 26;
const STEP = (Math.PI * 2) / Appearances.length;

type Host = RefObject<ComponentRef<typeof View> | null>;

/**
 * The single place to change themes: a circle that, when pressed and held, fans every theme
 * out on a wheel. Slide toward one and release to apply it; a plain tap opens the wheel for
 * tapping instead. `host` is the full-screen view the wheel is drawn over, so the hook
 * returns the trigger and the overlay separately.
 */
export function useThemeWheel(host: Host) {
  const theme = useTheme();
  const accent = useAccent();
  const appearance = useUserData().settings.appearance;
  const trigger = useRef<ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [highlight, setHighlight] = useState(-1);
  // Responder callbacks read these synchronously, before React re-renders.
  const gesture = useRef({ startX: 0, startY: 0, open: false, highlight: -1, timer: 0 });
  const progress = useSharedValue(0);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.35 + progress.get() * 0.65 }, { rotate: `${(1 - progress.get()) * -40}deg` }],
  }));

  const openWheel = () => {
    if (gesture.current.open) return;
    gesture.current.open = true;
    trigger.current?.measureInWindow((tx, ty, tw, th) => {
      host.current?.measureInWindow((hx, hy, hw, hh) => {
        // Center the wheel on the circle, nudged inward so every theme stays on screen.
        const margin = RADIUS + ITEM / 2 + 24;
        const clamp = (v: number, max: number) => Math.min(Math.max(v, margin), Math.max(margin, max - margin));
        setCenter({ x: clamp(tx - hx + tw / 2, hw), y: clamp(ty - hy + th / 2, hh) });
        setOpen(true);
        progress.set(0);
        progress.set(withSpring(1, { damping: 14, stiffness: 180 }));
      });
    });
  };

  const close = () => {
    gesture.current.open = false;
    gesture.current.highlight = -1;
    setHighlight(-1);
    setOpen(false);
    progress.set(0);
  };

  const choose = (id: Appearance) => {
    updateSettings({ appearance: id });
    close();
  };

  const track = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - gesture.current.startX;
    const dy = e.nativeEvent.pageY - gesture.current.startY;
    if (!gesture.current.open) {
      if (Math.hypot(dx, dy) > 12) openWheel();
      return;
    }
    let index = -1;
    if (Math.hypot(dx, dy) > DEAD_ZONE) {
      // Item 0 sits at 12 o'clock and the rest follow clockwise.
      const angle = Math.atan2(dy, dx) + Math.PI / 2;
      index = ((Math.round(angle / STEP) % Appearances.length) + Appearances.length) % Appearances.length;
    }
    if (index !== gesture.current.highlight) {
      gesture.current.highlight = index;
      setHighlight(index);
    }
  };

  const current = Appearances.find((a) => a.id === appearance) ?? Appearances[0];
  const focused = highlight >= 0 ? Appearances[highlight] : current;

  const triggerElement = (
    <View
      ref={trigger}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${current.label}. Press and hold to change`}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        gesture.current.startX = e.nativeEvent.pageX;
        gesture.current.startY = e.nativeEvent.pageY;
        gesture.current.highlight = -1;
        gesture.current.timer = Number(setTimeout(openWheel, HOLD_MS));
      }}
      onResponderMove={track}
      onResponderRelease={() => {
        clearTimeout(gesture.current.timer);
        const picked = gesture.current.highlight;
        if (!gesture.current.open) openWheel();
        else if (picked >= 0) choose(Appearances[picked].id);
        // Released without sliding: the wheel stays open for tapping.
      }}
      onResponderTerminate={() => clearTimeout(gesture.current.timer)}
      style={[
        styles.trigger,
        { borderColor: theme.brutal ? theme.border : accent },
        theme.brutal && styles.triggerBrutal,
      ]}>
      <Swatch colors={current.swatch} size={36} />
    </View>
  );

  const overlay = open ? (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={close} accessibilityLabel="Close themes" />
      <Animated.View
        pointerEvents="box-none"
        style={[styles.ring, { left: center.x - RADIUS - ITEM, top: center.y - RADIUS - ITEM }, ringStyle]}>
        <View style={[styles.hub, { backgroundColor: theme.backgroundElement, borderColor: accent }]}>
          <ThemedText type="smallBold" style={styles.hubText} numberOfLines={2}>
            {focused.label}
          </ThemedText>
        </View>
        {Appearances.map((option, i) => {
          const angle = i * STEP - Math.PI / 2;
          const active = i === highlight || (highlight < 0 && option.id === appearance);
          return (
            <Pressable
              key={option.id}
              accessibilityLabel={`${option.label} theme`}
              onPress={() => choose(option.id)}
              style={[
                styles.item,
                {
                  left: RADIUS + ITEM + Math.cos(angle) * RADIUS - ITEM / 2,
                  top: RADIUS + ITEM + Math.sin(angle) * RADIUS - ITEM / 2,
                  borderColor: active ? accent : 'rgba(255,255,255,0.85)',
                  transform: [{ scale: i === highlight ? 1.22 : 1 }],
                },
              ]}>
              <Swatch colors={option.swatch} size={ITEM - 8} />
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  ) : null;

  return { trigger: triggerElement, overlay, label: current.label };
}

function Swatch({ colors, size }: { colors: [string, string]; size: number }) {
  return (
    <View style={[styles.swatch, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.half, { backgroundColor: colors[0] }]} />
      <View style={[styles.half, { backgroundColor: colors[1] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerBrutal: {
    boxShadow: '3px 3px 0px #000000',
  },
  swatch: {
    overflow: 'hidden',
    flexDirection: 'row',
    transform: [{ rotate: '45deg' }],
  },
  half: {
    flex: 1,
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  ring: {
    position: 'absolute',
    width: (RADIUS + ITEM) * 2,
    height: (RADIUS + ITEM) * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hub: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  hubText: {
    textAlign: 'center',
  },
  item: {
    position: 'absolute',
    width: ITEM,
    height: ITEM,
    borderRadius: ITEM / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 14px rgba(0,0,0,0.4)',
  },
});
