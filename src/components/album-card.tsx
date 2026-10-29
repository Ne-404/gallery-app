import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Album } from '@/lib/scopes';

export function AlbumCard({
  album,
  size,
  onPress,
  onLongPress,
}: {
  album: Album;
  size: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const cover = album.items[0];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ width: size }, styles.card, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={[styles.cover, { width: size, height: size }]}>
        {cover ? (
          <Image source={{ uri: cover.thumbUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Icon {...album.icon} size={32} />
        )}
      </ThemedView>
      <ThemedText type="smallBold" numberOfLines={1}>
        {album.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
        {album.items.length} {album.items.length === 1 ? 'item' : 'items'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.half,
  },
  cover: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  count: {
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.6,
  },
});
