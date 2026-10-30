import { router } from 'expo-router';
import { memo } from 'react';
import { PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EditedImage } from '@/components/edited-image';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { LikeColor, Spacing } from '@/constants/theme';
import { useLike } from '@/hooks/use-like';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/dates';
import { sizedDemoUri } from '@/lib/demo';
import { aspectRatio, type Edit } from '@/lib/edits';
import { useT } from '@/lib/i18n';
import type { MediaItem } from '@/lib/media';
import type { Scope } from '@/lib/scopes';
import type { Note } from '@/lib/user-data';

/** Tall photos stay tall and wide ones wide, within limits, so the columns interleave. */
const MIN_RATIO = 0.62;
const MAX_RATIO = 1.5;

export const pinRatio = (item: MediaItem, edit?: Edit) =>
  Math.min(MAX_RATIO, Math.max(MIN_RATIO, aspectRatio(edit, item.width, item.height)));

type PinCardProps = {
  item: MediaItem;
  scope: Scope;
  width: number;
  edit?: Edit;
  liked: boolean;
  note?: Note;
  /** Custom name from "Rename". */
  title?: string;
  /** Handlers take the item id, so the feed can pass the same functions to every card. */
  onNote: (itemId: string) => void;
  onMore: (itemId: string) => void;
  /** Press and hold the photo to start selecting. */
  onSelect?: (itemId: string) => void;
};

/**
 * A Pinterest-style feed card: the photo at its own shape with rounded corners, then a short
 * line (its name or note) with like and more buttons. Tap opens it, double-tap likes it.
 * Memoized, and recycled by the masonry list, so it keeps no per-item state of its own.
 */
export const PinCard = memo(function PinCard({
  item,
  scope,
  width,
  edit,
  liked,
  note,
  title,
  onNote,
  onMore,
  onSelect,
}: PinCardProps) {
  const theme = useTheme();
  const t = useT();
  const { toggle, onTap, heartStyle } = useLike();
  const openViewer = () => router.push({ pathname: '/viewer', params: { id: item.id, scope } });
  const caption = note?.text ?? title;
  // Sample photos are fetched at the card's size instead of the full 1080–1600px original.
  // Device photos don't need it: expo-image already loads those at view size.
  const source =
    item.type === 'video' ? item.thumbUri : (sizedDemoUri(item.uri, width * PixelRatio.get()) ?? item.uri);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onTap(item.id, openViewer)}
        onLongPress={onSelect ? () => onSelect(item.id) : undefined}
        delayLongPress={400}
        accessibilityLabel={title ?? (item.type === 'video' ? t('Video') : t('Photo'))}
        style={[
          styles.media,
          { width, height: width / pinRatio(item, edit), backgroundColor: theme.backgroundElement },
          theme.outline > 0 && { borderWidth: theme.outline, borderColor: theme.border },
          theme.shadow !== undefined && { boxShadow: theme.shadow },
        ]}>
        <EditedImage
          uri={source}
          placeholderUri={item.thumbUri}
          edit={edit}
          sourceAspect={item.width / item.height}
          style={StyleSheet.absoluteFill}
          recyclingKey={item.id}
        />
        {item.type === 'video' && (
          <View style={styles.videoBadge}>
            <Icon ios="play.fill" android="play_arrow" size={12} color="#fff" />
            {item.duration ? (
              <ThemedText type="smallBold" style={styles.white}>
                {formatDuration(item.duration)}
              </ThemedText>
            ) : null}
          </View>
        )}
        <Animated.View pointerEvents="none" style={[styles.heartBurst, heartStyle]}>
          <Icon ios="heart.fill" android="favorite" size={64} color="#fff" />
        </Animated.View>
      </Pressable>

      <View style={styles.footer}>
        <Pressable
          onPress={note ? () => onNote(item.id) : undefined}
          disabled={!note}
          accessibilityLabel={note ? t('Edit note') : undefined}
          style={styles.flex}>
          {caption ? (
            <ThemedText type="small" numberOfLines={2} style={styles.caption}>
              {caption}
            </ThemedText>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => toggle(item.id)}
          hitSlop={6}
          accessibilityLabel={liked ? t('Unlike') : t('Like')}
          style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
          <Icon
            ios={liked ? 'heart.fill' : 'heart'}
            android={liked ? 'favorite' : 'favorite_border'}
            size={18}
            color={liked ? LikeColor : theme.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={() => onMore(item.id)}
          hitSlop={6}
          accessibilityLabel={t('More options')}
          style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
          <Icon ios="ellipsis" android="more_horiz" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    paddingBottom: Spacing.three,
  },
  media: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  videoBadge: {
    position: 'absolute',
    top: Spacing.two,
    end: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  white: {
    color: '#fff',
    fontSize: 11,
  },
  heartBurst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.half,
    paddingTop: Spacing.one,
    paddingStart: Spacing.one,
    minHeight: 28,
  },
  flex: {
    flex: 1,
  },
  caption: {
    fontSize: 13,
    lineHeight: 17,
    paddingTop: 3,
  },
  icon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
});
