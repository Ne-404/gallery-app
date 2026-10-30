import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Vinyl } from '@/components/vinyl';
import { MaxFeedWidth, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { next, togglePlay, trackLabels, useDetectedTracks, useMusic } from '@/lib/music';
import { useUserData } from '@/lib/user-data';

/** Height of the bar, so overlays (toasts) can sit above it. */
export const MINI_PLAYER_HEIGHT = 56;

/**
 * Now-playing bar above the tab bar while a song is loaded (hidden on the Music tab itself).
 * Tap it to open Music.
 */
export function MiniPlayer() {
  const music = useMusic();
  const { tracks: imported } = useUserData();
  const { tracks: onDevice } = useDetectedTracks();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  const track = [...imported, ...onDevice].find((entry) => entry.id === music.currentId);
  if (!track || pathname === '/music') return null;
  const labels = trackLabels(track, t);
  const progress = music.duration ? Math.min(1, music.position / music.duration) : 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(150)}
      style={[styles.wrap, { bottom: insets.bottom + Spacing.three + 68 + Spacing.two }]}>
      <Pressable
        onPress={() => router.navigate('/music')}
        accessibilityLabel={t('Now playing: {name}. Open music', { name: labels.title })}
        style={styles.inner}>
        <ThemedView type="backgroundElement" style={[styles.bar, theme.outline === 0 && styles.shadow]}>
          <Vinyl size={34} color={accent} spinning={music.playing} />
          <View style={styles.text}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {labels.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.artist}>
              {labels.artist}
            </ThemedText>
          </View>
          <Pressable onPress={togglePlay} hitSlop={8} accessibilityLabel={music.playing ? t('Pause') : t('Play')} style={styles.button}>
            <Icon ios={music.playing ? 'pause.fill' : 'play.fill'} android={music.playing ? 'pause' : 'play_arrow'} size={24} />
          </Pressable>
          <Pressable onPress={next} hitSlop={8} accessibilityLabel={t('Next song')} style={styles.button}>
            <Icon ios="forward.fill" android="skip_next" size={22} />
          </Pressable>
          <View style={[styles.progress, { width: `${progress * 100}%`, backgroundColor: accent }]} />
        </ThemedView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  // On tablets the bar stays phone-sized, centered over the tab bar.
  inner: {
    width: '100%',
    maxWidth: MaxFeedWidth,
  },
  bar: {
    height: MINI_PLAYER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.two + 2,
    paddingRight: Spacing.one,
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  shadow: {
    boxShadow: '0px 6px 20px rgba(0,0,0,0.16)',
  },
  text: {
    flex: 1,
  },
  artist: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
  },
});
