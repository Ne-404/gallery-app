import { memo } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EditedImage } from '@/components/edited-image';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { LikeColor, Spacing } from '@/constants/theme';
import { useLike } from '@/hooks/use-like';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDuration, timeAgo } from '@/lib/dates';
import { aspectRatio, type Edit } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';
import type { Scope } from '@/lib/scopes';
import type { Note } from '@/lib/user-data';

const KIND_LABELS = {
  single: 'Photo',
  burst: 'Burst',
  live: 'Live Photo',
  video: 'Video',
  screenshot: 'Screenshot',
} as const;

type PostCardProps = {
  item: MediaItem;
  scope: Scope;
  width: number;
  edit?: Edit;
  liked: boolean;
  saved: boolean;
  note?: Note;
  hideDates: boolean;
  /** Custom name from "Rename". */
  title?: string;
  /** Handlers take the item id, so the feed can pass the same functions to every post. */
  onNote: (itemId: string) => void;
  onSave: (itemId: string) => void;
  onMore: (itemId: string) => void;
  /** Press and hold the photo to start selecting. */
  onSelect?: (itemId: string) => void;
};

/** A feed post: header, media (double-tap to like), action row and journal caption. */
/**
 * Memoized: a like or note on one post doesn't re-render every other post in the feed.
 */
export const PostCard = memo(function PostCard({
  item,
  scope,
  width,
  edit,
  liked,
  saved,
  note,
  hideDates,
  title,
  onNote,
  onSave,
  onMore,
  onSelect,
}: PostCardProps) {
  const theme = useTheme();
  const { toggle, onTap, heartStyle } = useLike();
  // Instagram clamps feed media between 4:5 portrait and 1.91:1 landscape.
  const ratio = Math.min(1.91, Math.max(0.8, aspectRatio(edit, item.width, item.height)));
  // Neo-brutalist posts are inset cards, so the media is narrower than the screen.
  const mediaWidth = theme.brutal ? width - Spacing.three * 2 - theme.outline * 2 : width;
  const openViewer = () => router.push({ pathname: '/viewer', params: { id: item.id, scope } });

  return (
    <View
      style={[
        styles.post,
        theme.brutal && {
          marginHorizontal: Spacing.three,
          marginBottom: Spacing.four,
          backgroundColor: theme.backgroundElement,
          borderWidth: theme.outline,
          borderColor: theme.border,
          boxShadow: theme.shadow,
        },
      ]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
          <Icon
            ios={item.type === 'video' ? 'video.fill' : 'photo'}
            android={item.type === 'video' ? 'videocam' : 'photo_library'}
            size={16}
          />
        </View>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">
            {title ?? (hideDates ? KIND_LABELS[item.kind] : formatDate(item.createdAt))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
            {hideDates ? 'Private' : KIND_LABELS[item.kind]}
            {edit ? ' · Edited' : ''}
          </ThemedText>
        </View>
        <Pressable onPress={() => onMore(item.id)} hitSlop={10} accessibilityLabel="More options" style={styles.more}>
          <Icon ios="ellipsis" android="more_vert" size={20} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          // Tap opens the photo full screen; double-tap likes it.
          onTap(item.id, openViewer);
        }}
        onLongPress={onSelect ? () => onSelect(item.id) : undefined}
        delayLongPress={400}
        style={[
          { width: mediaWidth, height: mediaWidth / ratio },
          theme.brutal && { borderTopWidth: theme.outline, borderBottomWidth: theme.outline, borderColor: theme.border },
        ]}>
        <EditedImage
          uri={item.type === 'video' ? item.thumbUri : item.uri}
          placeholderUri={item.thumbUri}
          edit={edit}
          sourceAspect={item.width / item.height}
          style={StyleSheet.absoluteFill}
          recyclingKey={item.id}
        />
        {item.type === 'video' && (
          <View style={styles.videoBadge}>
            <Icon ios="play.fill" android="play_arrow" size={14} color="#fff" />
            {item.duration ? (
              <ThemedText type="smallBold" style={styles.white}>
                {formatDuration(item.duration)}
              </ThemedText>
            ) : null}
          </View>
        )}
        <Animated.View pointerEvents="none" style={[styles.heartBurst, heartStyle]}>
          <Icon ios="heart.fill" android="favorite" size={96} color="#fff" />
        </Animated.View>
      </Pressable>

      <View style={styles.actions}>
        <Action onPress={() => toggle(item.id)} label={liked ? 'Unlike' : 'Like'}>
          <Icon
            ios={liked ? 'heart.fill' : 'heart'}
            android={liked ? 'favorite' : 'favorite_border'}
            size={26}
            color={liked ? LikeColor : undefined}
          />
        </Action>
        <Action onPress={() => onNote(item.id)} label="Note">
          <Icon ios="bubble.right" android="chat_bubble" size={24} />
        </Action>
        {item.type === 'photo' && (
          <Action
            onPress={() => router.push({ pathname: '/editor', params: { id: item.id } })}
            label="Edit">
            <Icon ios="slider.horizontal.3" android="tune" size={24} />
          </Action>
        )}
        <View style={styles.flex} />
        <Action onPress={() => onSave(item.id)} label="Save">
          <Icon
            ios={saved ? 'bookmark.fill' : 'bookmark'}
            android={saved ? 'bookmark' : 'bookmark_border'}
            size={24}
          />
        </Action>
      </View>

      <View style={styles.caption}>
        {liked && <ThemedText type="smallBold">You loved this</ThemedText>}
        {note ? (
          <Pressable onPress={() => onNote(item.id)}>
            <ThemedText type="small">
              <ThemedText type="smallBold">you </ThemedText>
              {note.text}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable onPress={() => onNote(item.id)}>
            <ThemedText type="small" themeColor="textSecondary">
              Add a private note…
            </ThemedText>
          </Pressable>
        )}
        {!hideDates && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
            {timeAgo(item.createdAt)}
          </ThemedText>
        )}
      </View>
    </View>
  );
});

function Action({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  more: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  post: {
    paddingBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  videoBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
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
    fontSize: 12,
  },
  heartBurst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
  },
  action: {
    padding: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  caption: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.half,
  },
  time: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.5,
  },
});
