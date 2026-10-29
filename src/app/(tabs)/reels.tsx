import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { MediaGrid } from '@/components/media-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/dates';

type Sort = 'newest' | 'longest';

/** Every video in the library (stories play from the Profile instead). Tap one to watch it. */
export default function VideosScreen() {
  const { data, scoped } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const [sort, setSort] = useState<Sort>('newest');
  const videos = scoped('video');
  const sorted = sort === 'longest' ? [...videos].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0)) : videos;
  const total = videos.reduce((sum, v) => sum + (v.duration ?? 0), 0);

  const header = (
    <View style={styles.header}>
      <ThemedText type="small" themeColor="textSecondary">
        {videos.length} {videos.length === 1 ? 'video' : 'videos'}
        {total > 0 ? ` · ${formatDuration(total)} total` : ''}
      </ThemedText>
      <View style={styles.sorts}>
        {(['newest', 'longest'] as Sort[]).map((option) => {
          const active = sort === option;
          return (
            <Pressable
              key={option}
              accessibilityLabel={`Sort by ${option}`}
              onPress={() => {
                setSort(option);
              }}
              style={[
                styles.sort,
                { backgroundColor: active ? `${accent}22` : theme.backgroundElement },
                active && { borderColor: accent },
              ]}>
              <ThemedText type="smallBold" style={{ color: active ? accent : theme.textSecondary }}>
                {option === 'newest' ? 'Newest' : 'Longest'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar title="Videos" />
        <MediaGrid
          key={sort}
          items={sorted}
          scope="video"
          columns={2}
          likes={data.likes}
          edits={data.edits}
          header={header}
          empty={
            <View style={styles.empty}>
              <Icon ios="video" android="videocam" size={40} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.center}>
                No videos in your library yet.
              </ThemedText>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sorts: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  sort: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.six,
  },
  center: {
    textAlign: 'center',
  },
});
