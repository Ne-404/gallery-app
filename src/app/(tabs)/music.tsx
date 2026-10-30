import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { Slider } from '@/components/slider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Vinyl } from '@/components/vinyl';
import { BottomTabInset, MaxFeedWidth, Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/dates';
import { canScanDevice } from '@/lib/device-files';
import { dirProps, dirStyle } from '@/lib/direction';
import { useT } from '@/lib/i18n';
import {
  deleteSong,
  importSongs,
  next,
  playTrack,
  previous,
  chooseMusicFolder,
  scanDeviceMusic,
  seek,
  setVolume,
  togglePlay,
  toggleRepeat,
  toggleShuffle,
  trackLabels,
  useDetectedTracks,
  useMusic,
} from '@/lib/music';
import { blockSwipe, confirmAction } from '@/lib/ui';
import { useUserData } from '@/lib/user-data';

/** A record player: the record spins while a song plays. No album art, just vinyl. */
export default function MusicScreen() {
  const { tracks: imported } = useUserData();
  const music = useMusic();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  const width = useAppWidth();
  const { tracks: onDevice, scanning } = useDetectedTracks();
  const allSongs = [...imported, ...onDevice];
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  // The list doesn't scroll while the record is being turned.
  const [turning, setTurning] = useState(false);
  const needle = searching ? query.trim().toLowerCase() : '';
  const tracks = allSongs.filter((track) => {
    const labels = trackLabels(track, t);
    return !needle || `${labels.title} ${labels.artist}`.toLowerCase().includes(needle);
  });

  // Songs on the device are found automatically each time the player opens.
  useEffect(() => {
    scanDeviceMusic();
  }, []);
  const current = allSongs.find((track) => track.id === music.currentId);
  const currentLabels = current && trackLabels(current, t);
  const deck = Math.min(width - Spacing.three * 2, 360);
  const record = deck * 0.72;
  // The song list stays a readable column on tablets.
  const gutter = (width - Math.min(width, MaxFeedWidth)) / 2;

  const addSongs = async () => {
    await importSongs();
  };

  const header = (
    <View style={styles.header}>
      <ThemedView
        type="backgroundElement"
        {...dirProps('ltr')}
        style={[styles.deck, dirStyle('ltr'), { width: deck, height: deck * 0.86 }]}>
        {/* A turntable, not text: the arm stays on the right in every language. */}
        <VolumeRecord
          size={record}
          color={accent}
          spinning={music.playing}
          volume={music.volume}
          onTurning={setTurning}
        />
        <Tonearm length={record * 0.62} onRecord={music.playing} color={theme.text} onPress={togglePlay} />
        <View style={[styles.led, { backgroundColor: music.playing ? '#2BB673' : theme.backgroundSelected }]} />
      </ThemedView>

      <View style={styles.nowPlaying}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
          {currentLabels?.title ?? t('Nothing playing')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {currentLabels ? (music.loading && !music.playing ? t('Loading…') : currentLabels.artist) : t('Pick a song to drop the needle')}
        </ThemedText>
      </View>

      <View style={styles.progress}>
        <Slider
          value={Math.min(music.position, music.duration || 1)}
          min={0}
          max={music.duration || 1}
          color={accent}
          onChange={(v) => current && seek(v)}
        />
        <View style={styles.times}>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDuration(music.position)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {music.duration ? formatDuration(music.duration) : '--:--'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.controls}>
        <IconButton label={t('Shuffle')} onPress={toggleShuffle}>
          <Icon ios="shuffle" android="shuffle" size={22} color={music.shuffle ? accent : theme.textSecondary} />
        </IconButton>
        <IconButton label={t('Previous')} onPress={previous}>
          <Icon ios="backward.fill" android="skip_previous" size={30} />
        </IconButton>
        <Pressable
          onPress={() => {
            togglePlay();
          }}
          accessibilityLabel={music.playing ? t('Pause') : t('Play')}
          style={({ pressed }) => [styles.play, { backgroundColor: accent }, pressed && styles.pressed]}>
          <Icon ios={music.playing ? 'pause.fill' : 'play.fill'} android={music.playing ? 'pause' : 'play_arrow'} size={34} color="#fff" />
        </Pressable>
        <IconButton label={t('Next')} onPress={next}>
          <Icon ios="forward.fill" android="skip_next" size={30} />
        </IconButton>
        <IconButton label={t('Repeat')} onPress={toggleRepeat}>
          <Icon ios="repeat.1" android="repeat_one" size={22} color={music.repeat ? accent : theme.textSecondary} />
        </IconButton>
      </View>

      <View style={styles.listHeader}>
        <View>
          <ThemedText type="smallBold" style={styles.listTitle}>
            {t('Songs')}
          </ThemedText>
          {/* Only where the device can be scanned: on web it would always say 0. */}
          {canScanDevice && (
            <ThemedText type="small" themeColor="textSecondary">
              {scanning ? t('Looking for music on this device…') : t('{n} found on this device', { n: onDevice.length })}
            </ThemedText>
          )}
        </View>
        <Pressable onPress={addSongs} accessibilityLabel={t('Import songs')} style={styles.importButton}>
          <Icon ios="plus" android="add" size={18} color={accent} />
          <ThemedText type="smallBold" style={{ color: accent }}>
            {t('Import')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title={t('Music')}
          actions={
            <>
              <IconButton
                label={searching ? t('Close search') : t('Search songs')}
                onPress={() => {
                  setSearching(!searching);
                  setQuery('');
                }}>
                <Icon ios={searching ? 'xmark' : 'magnifyingglass'} android={searching ? 'close' : 'search'} />
              </IconButton>
              {canScanDevice && (
                <IconButton label={t('Choose a music folder')} onPress={chooseMusicFolder}>
                  <Icon ios="folder.badge.gearshape" android="folder_open" />
                </IconButton>
              )}
              <IconButton label={t('Import songs')} onPress={addSongs}>
                <Icon ios="square.and.arrow.down" android="library_add" />
              </IconButton>
            </>
          }
        />
        {searching && (
          <ThemedView type="backgroundElement" style={styles.search}>
            <Icon ios="magnifyingglass" android="search" size={20} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('Search songs')}
              placeholderTextColor={theme.textSecondary}
              autoFocus
              returnKeyType="search"
              accessibilityLabel={t('Search songs')}
              style={[styles.searchInput, { color: theme.text }, noFocusRing]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('Clear search')}>
                <Icon ios="xmark.circle.fill" android="close" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </ThemedView>
        )}
        <FlatList
          data={tracks}
          keyExtractor={(track) => track.id}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          extraData={music.currentId}
          scrollEnabled={!turning}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {allSongs.length === 0 ? t('No songs yet. Add some to start listening.') : t('No songs match')}
            </ThemedText>
          }
          renderItem={({ item, index }) => {
            const active = item.id === music.currentId;
            // Only imported copies can be deleted here; device songs stay where they are.
            const removable = !item.id.startsWith('device:');
            const labels = trackLabels(item, t);
            return (
              <Pressable
                onPress={() => {
                  if (active) togglePlay();
                  else playTrack(item);
                }}
                onLongPress={
                  !removable
                    ? undefined
                    : () =>
                        confirmAction(
                          t('Delete “{name}”?', { name: labels.title }),
                          t('It’s removed from this app.'),
                          t('Delete'),
                          () => deleteSong(item)
                        )
                }
                accessibilityLabel={t('Play {name}', { name: labels.title })}
                style={({ pressed }) => [styles.row, active && { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
                <View style={styles.rowIcon}>
                  {active ? (
                    <Vinyl size={30} color={accent} spinning={music.playing} />
                  ) : (
                    <ThemedText themeColor="textSecondary">{index + 1}</ThemedText>
                  )}
                </View>
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1} style={[styles.rowTitle, active && { color: accent }]}>
                    {labels.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {labels.artist}
                  </ThemedText>
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/** Degrees the record turns between silent and loudest, so its mark shows the level. */
const TURN_RANGE = 300;

/**
 * The record is the volume knob: drag up (or right) to go louder, down (or left) to go
 * quieter. A drag across the whole record covers the full range, and the level shows
 * while turning.
 */
function VolumeRecord({
  size,
  color,
  spinning,
  volume,
  onTurning,
}: {
  size: number;
  color: string;
  spinning: boolean;
  volume: number;
  onTurning: (turning: boolean) => void;
}) {
  const t = useT();
  const [turning, setTurning] = useState(false);
  const outer = size + 14;
  // The level lives on the UI thread while turning; the store catches up asynchronously,
  // so it's only synced back when idle (otherwise stale updates undo the drag).
  const level = useSharedValue(volume);
  useEffect(() => {
    if (!turning) level.set(volume);
  }, [volume, turning, level]);

  // Turning the knob mustn't switch tabs or scroll the list.
  const startTurn = () => {
    blockSwipe(60_000);
    setTurning(true);
    onTurning(true);
  };
  const endTurn = () => {
    blockSwipe();
    setTurning(false);
    onTurning(false);
  };

  const turn = usePanGesture({
    minDistance: 4,
    onActivate: () => {
      'worklet';
      scheduleOnRN(startTurn);
    },
    onUpdate: (e) => {
      'worklet';
      const next = Math.max(0, Math.min(1, level.get() + (e.changeX - e.changeY) / outer));
      if (next !== level.get()) {
        level.set(next);
        scheduleOnRN(setVolume, next);
      }
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(endTurn);
    },
  });
  const twistStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${level.get() * TURN_RANGE}deg` }] }));
  const percent = Math.round(volume * 100);

  return (
    <GestureDetector gesture={turn}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('Volume')}
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => setVolume(volume + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))}
        style={[styles.platter, { width: outer, height: outer, borderRadius: outer / 2 }]}>
        <Animated.View style={twistStyle}>
          <Vinyl size={size} color={color} spinning={spinning} />
        </Animated.View>
        {turning && (
          <View style={styles.volumeBadge} pointerEvents="none">
            <Icon
              ios={volume === 0 ? 'speaker.slash.fill' : 'speaker.wave.2.fill'}
              android={volume === 0 ? 'volume_off' : 'volume_up'}
              size={16}
              color="#fff"
            />
            <Text style={styles.volumeText}>{percent}%</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

/**
 * The arm swings onto the record when playing and back to its rest when paused. Tap it to
 * drop the needle (play) or lift it (pause).
 */
function Tonearm({
  length,
  onRecord,
  color,
  onPress,
}: {
  length: number;
  onRecord: boolean;
  color: string;
  onPress: () => void;
}) {
  const t = useT();
  const angle = useSharedValue(onRecord ? 24 : 0);
  useEffect(() => {
    angle.set(withTiming(onRecord ? 24 : 0, { duration: 600 }));
  }, [onRecord, angle]);
  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={onRecord ? t('Pause') : t('Play')}
      // The arm swings left onto the record, so the touch area reaches that way too.
      hitSlop={{ left: length * 0.45, right: Spacing.two, bottom: Spacing.two }}
      style={[styles.armPivot, { height: length + 28 }]}>
      <Animated.View style={[styles.armSwing, { height: length }, swing]}>
        <View style={[styles.arm, { height: length, backgroundColor: color }]} />
        <View style={[styles.headshell, { backgroundColor: color }]} />
      </Animated.View>
      <View style={[styles.pivotCap, { borderColor: color }]} />
    </Pressable>
  );
}

const noFocusRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  list: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  deck: {
    borderRadius: Spacing.four,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: Spacing.three,
  },
  platter: {
    backgroundColor: '#2A2A2E',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 6px 18px rgba(0,0,0,0.35)',
  },
  led: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  armPivot: {
    position: 'absolute',
    top: Spacing.four,
    right: Spacing.four,
    width: 28,
    alignItems: 'center',
  },
  armSwing: {
    position: 'absolute',
    top: 14,
    width: 28,
    alignItems: 'center',
    // Rotate around the pivot at the top of the arm.
    transformOrigin: 'top',
  },
  arm: {
    width: 5,
    borderRadius: 3,
  },
  headshell: {
    width: 14,
    height: 22,
    borderRadius: 3,
    marginTop: -4,
  },
  pivotCap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 5,
    backgroundColor: '#555',
  },
  nowPlaying: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.half,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  progress: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.four,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  volumeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.four,
  },
  listHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  listTitle: {
    fontSize: 16,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
  rowIcon: {
    width: 30,
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.6,
  },
});
