import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';

export const PASSCODE_LENGTH = 4;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;

type PinPadProps = {
  title: string;
  subtitle?: string;
  /** Shown in red; changing `attempt` with an error set shakes the dots. */
  error?: string;
  attempt?: number;
  /** Called with the full passcode; the dots clear for the next entry. */
  onComplete: (passcode: string) => void;
};

/** Lock-screen style passcode entry. Also accepts the number keys on web. */
export function PinPad({ title, subtitle, error, attempt = 0, onComplete }: PinPadProps) {
  const theme = useTheme();
  const accent = useAccent();
  const [digits, setDigits] = useState('');
  const shake = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  useEffect(() => {
    if (!error) return;
    shake.set(
      withSequence(
        withTiming(-12, { duration: 50 }),
        withTiming(12, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 })
      )
    );
  }, [error, attempt, shake]);

  const press = (key: (typeof KEYS)[number]) => {
    if (!key) return;
    if (key === 'delete') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    const next = digits + key;
    if (next.length < PASSCODE_LENGTH) {
      setDigits(next);
      return;
    }
    setDigits('');
    onComplete(next);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === 'Backspace') press('delete');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <View style={styles.container}>
      <View style={[styles.lock, { backgroundColor: `${accent}22` }]}>
        <Icon ios="lock.fill" android="lock" size={30} color={accent} />
      </View>
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" style={[styles.subtitle, { color: error ? '#E5484D' : theme.textSecondary }]}>
        {error || subtitle || ' '}
      </ThemedText>

      <Animated.View style={[styles.dots, shakeStyle]}>
        {Array.from({ length: PASSCODE_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: theme.text },
              i < digits.length && { backgroundColor: theme.text },
            ]}
          />
        ))}
      </Animated.View>

      <View style={styles.pad}>
        {KEYS.map((key, i) =>
          key ? (
            <Pressable
              key={key}
              onPress={() => press(key)}
              accessibilityLabel={key === 'delete' ? 'Delete digit' : key}
              style={({ pressed }) => [
                styles.key,
                key !== 'delete' && { backgroundColor: theme.backgroundElement },
                key !== 'delete' && theme.outline > 0 && { borderWidth: theme.outline, borderColor: theme.border },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              {key === 'delete' ? (
                <Icon ios="delete.left" android="backspace" size={24} />
              ) : (
                <ThemedText style={styles.keyText}>{key}</ThemedText>
              )}
            </Pressable>
          ) : (
            <View key={`blank-${i}`} style={styles.key} />
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  lock: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  subtitle: {
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginVertical: Spacing.four,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    width: 72 * 3 + Spacing.three * 2,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 500,
  },
});
