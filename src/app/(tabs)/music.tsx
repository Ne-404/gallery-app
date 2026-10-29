import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { Slider } from '@/components/slider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Vinyl } from '@/components/vinyl';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/dates';
import { canScanDevice } from '@/lib/device-files';
import {
  deleteSong,
  importSongs,
  next,
  playTrack,
  previous,
  chooseMusicFolder,
  SAMPLE_TRACKS,
  scanDeviceMusic,
  seek,
  togglePlay,
  toggleRepeat,
  toggleShuffle,
  useDetectedTracks,
  useMusic,
} from '@/lib/music';
import { confirmAction } from '@/lib/ui';
import { useUserData } from '@/lib/user-data';

/** A record player: the record spins while a song plays. No album art, just vinyl. */
export default function MusicScreen() {
  const { tracks: imported } = useUserData();
  const music = useMusic();
  const accent = useAccent();
  const theme = useTheme();
  const width = useAppWidth();
  const { tracks: onDevice, scanning } = useDetectedTracks();
  const tracks = [...imported, ...onDevice, ...SAMPLE_TRACKS];

  // Songs on the device are found automatically each time the player opens.
  useEffect(() => {
    scanDeviceMusic();
  }, []);
  const current = tracks.find((t) => t.id === music.currentId);
  const deck = Math.min(width - Spacing.three * 2, 360);
  const record = deck * 0.72;

  const addSongs = async () => {
    await importSongs();
  };

  const header = (
    <View style={styles.header}>
      <ThemedView type="backgroundElement" style={[styles.deck, { width: deck, height: deck * 0.86 }]}>
        <View style={[styles.platter, { width: record + 14, height: record + 14, borderRadius: (record + 14) / 2 }]}>
          <Vinyl size={record} color={accent} spinning={music.playing} />
        </View>
        <Tonearm length={record * 0.62} onRecord={music.playing} color={theme.text} />
        <View style={[styles.led, { backgroundColor: music.playing ? '#2BB673' : theme.backgroundSelected }]} />
      </ThemedView>

      <View style={styles.nowPlaying}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
          {current?.title ?? 'Nothing playing'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {current ? (music.loading && !music.playing ? 'Loading…' : current.artist) : 'Pick a song to drop the needle'}
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
        <IconButton label="Shuffle" onPress={toggleShuffle}>
          <Icon ios="shuffle" android="shuffle" size={22} color={music.shuffle ? accent : theme.textSecondary} />
        </IconButton>
        <IconButton label="Previous" onPress={previous}>
          <Icon ios="backward.fill" android="skip_previous" size={30} />
        </IconButton>
        <Pressable
          onPress={() => {
            togglePlay();
          }}
          accessibilityLabel={music.playing ? 'Pause' : 'Play'}
          style={({ pressed }) => [styles.play, { backgroundColor: accent }, pressed && styles.pressed]}>
          <Icon ios={music.playing ? 'pause.fill' : 'play.fill'} android={music.playing ? 'pause' : 'play_arrow'} size={34} color="#fff" />
        </Pressable>
        <IconButton label="Next" onPress={next}>
          <Icon ios="forward.fill" android="skip_next" size={30} />
        </IconButton>
        <IconButton label="Repeat" onPress={toggleRepeat}>
          <Icon ios="repeat.1" android="repeat_one" size={22} color={music.repeat ? accent : theme.textSecondary} />
        </IconButton>
      </View>

      <View style={styles.listHeader}>
        <View>
          <ThemedText type="smallBold" style={styles.listTitle}>
            Songs
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {scanning ? 'Looking for music on this device…' : `${onDevice.length} found on this device`}
          </ThemedText>
        </View>
        <Pressable onPress={addSongs} accessibilityLabel="Import songs" style={styles.importButton}>
          <Icon ios="plus" android="add" size={18} color={accent} />
          <ThemedText type="smallBold" style={{ color: accent }}>
            Import
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title="Music"
          actions={
            <>
              {canScanDevice && (
                <IconButton label="Choose a music folder" onPress={chooseMusicFolder}>
                  <Icon ios="folder.badge.gearshape" android="folder_open" />
                </IconButton>
              )}
              <IconButton label="Import songs" onPress={addSongs}>
                <Icon ios="square.and.arrow.down" android="library_add" />
              </IconButton>
            </>
          }
        />
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          extraData={music.currentId}
          renderItem={({ item, index }) => {
            const active = item.id === music.currentId;
            const isSample = item.id.startsWith('sample-');
            // Only imported copies can be deleted here; device songs stay where they are.
            const removable = !isSample && !item.id.startsWith('device:');
            return (
              <Pressable
                onPress={() => {
                  if (active) togglePlay();
                  else playTrack(item);
                }}
                onLongPress={
                  !removable
                    ? undefined
                    : () => confirmAction(`Delete “${item.title}”?`, 'It’s removed from this app.', 'Delete', () => deleteSong(item))
                }
                accessibilityLabel={`Play ${item.title}`}
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
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.artist}
                    {isSample ? ' · streamed sample' : ''}
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

/** The arm swings onto the record when playing and back to its rest when paused. */
function Tonearm({ length, onRecord, color }: { length: number; onRecord: boolean; color: string }) {
  const angle = useSharedValue(onRecord ? 24 : 0);
  useEffect(() => {
    angle.set(withTiming(onRecord ? 24 : 0, { duration: 600 }));
  }, [onRecord, angle]);
  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  return (
    <View style={styles.armPivot}>
      <Animated.View style={[styles.armSwing, { height: length }, swing]}>
        <View style={[styles.arm, { height: length, backgroundColor: color }]} />
        <View style={[styles.headshell, { backgroundColor: color }]} />
      </Animated.View>
      <View style={[styles.pivotCap, { borderColor: color }]} />
    </View>
  );
}

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
