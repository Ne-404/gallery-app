import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import type { Reel } from '@/lib/reels';

/**
 * The user's stories, used in the feed and as profile highlights. Tap plays a story in
 * Videos, long-press edits it, and the first bubble creates a new one.
 */
export function StoriesRow({ reels, size = 62 }: { reels: Reel[]; size?: number }) {
  const accent = useAccent();
  const theme = useTheme();
  const ring = { padding: 2, borderRadius: (size + 10) / 2, borderWidth: 2.5 };
  const image = { width: size, height: size, borderRadius: size / 2 };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable
        onPress={() => router.push('/story')}
        accessibilityLabel="New story"
        style={({ pressed }) => [styles.story, { width: size + 10 }, pressed && styles.pressed]}>
        <View style={[ring, { borderColor: 'transparent' }]}>
          <View style={[image, styles.newBubble, { borderColor: theme.textSecondary }]}>
            <Icon ios="plus" android="add" size={26} color={theme.text} />
          </View>
        </View>
        <ThemedText numberOfLines={1} style={styles.label}>
          New
        </ThemedText>
      </Pressable>
      {reels.map((reel) => (
        <Pressable
          key={reel.id}
          accessibilityLabel={`Story: ${reel.title}`}
          accessibilityHint="Hold to edit"
          onPress={() => router.push({ pathname: '/stories', params: { reel: reel.id } })}
          onLongPress={() => {
            router.push({ pathname: '/story', params: { id: reel.id } });
          }}
          style={({ pressed }) => [styles.story, { width: size + 10 }, pressed && styles.pressed]}>
          <View style={[ring, { borderColor: accent }]}>
            <Image source={{ uri: reel.items[0].thumbUri }} style={image} contentFit="cover" />
          </View>
          <ThemedText numberOfLines={1} style={styles.label}>
            {reel.title}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  story: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  newBubble: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.6,
  },
});
