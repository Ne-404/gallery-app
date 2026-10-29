import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MINI_PLAYER_HEIGHT } from '@/components/mini-player';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useMusic } from '@/lib/music';
import { hideToast, useToast } from '@/lib/toast';

/** Shows the current toast above the tab bar. Mounted once in the root layout. */
export function ToastHost() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const accent = useAccent();
  // Sit above the mini player when a song is loaded.
  const musicLoaded = useMusic().currentId !== null;
  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 100 + (musicLoaded ? MINI_PLAYER_HEIGHT + 8 : 0) }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
        accessibilityLiveRegion="polite"
        style={styles.toast}>
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.action && (
          <Pressable
            hitSlop={10}
            onPress={() => {
              toast.action?.onPress();
              hideToast();
            }}>
            <Text style={[styles.action, { color: accent === '#3c87f7' ? '#8AB8FF' : accent }]}>
              {toast.action.label}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    maxWidth: 420,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderRadius: Spacing.three,
    backgroundColor: '#2B2C30',
    boxShadow: '0px 6px 20px rgba(0,0,0,0.3)',
  },
  message: {
    flexShrink: 1,
    color: '#F2F2F4',
    fontSize: 14,
    fontWeight: 500,
  },
  action: {
    fontSize: 14,
    fontWeight: 700,
  },
});
