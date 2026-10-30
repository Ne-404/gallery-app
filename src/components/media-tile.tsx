import { router } from 'expo-router';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EditedImage } from '@/components/edited-image';
import { Icon } from '@/components/icon';
import { VideoSurface } from '@/components/video-surface';
import { LikeColor, Spacing } from '@/constants/theme';
import { formatDuration } from '@/lib/dates';
import type { Edit } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';
import type { Scope } from '@/lib/scopes';

/** A mouse resting on a video tile this long plays a muted preview (desktop web). */
const HOVER_PREVIEW_MS = 450;

type MediaTileProps = {
  item: MediaItem;
  size: number;
  /** Taller or shorter than square (masonry grids); square when omitted. */
  height?: number;
  /** Rounded corners (masonry grids). */
  radius?: number;
  liked: boolean;
  edit?: Edit;
  /** Number of frames when this tile stands in for a whole burst. */
  burstCount?: number;
  /** The list the viewer swipes through when this tile is opened. */
  scope: Scope;
  /** In selection mode a tap toggles the tile instead of opening it. */
  selecting?: boolean;
  selected?: boolean;
  /** Toggles selection; a long press starts selection mode with this tile. */
  onSelect?: (itemId: string) => void;
};

/** Memoized so a like or edit elsewhere doesn't re-render the whole grid. */
export const MediaTile = memo(function MediaTile({
  item,
  size,
  height = size,
  radius = 0,
  liked,
  edit,
  burstCount,
  scope,
  selecting,
  selected,
  onSelect,
}: MediaTileProps) {
  // The hovered item's id, not a flag: lists recycle tiles, so a stale flag could carry over.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const hoverTimer = useRef(0);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  return (
    <Pressable
      onHoverIn={
        item.type === 'video'
          ? () => {
              clearTimeout(hoverTimer.current);
              hoverTimer.current = Number(setTimeout(() => setPreviewing(item.id), HOVER_PREVIEW_MS));
            }
          : undefined
      }
      onHoverOut={() => {
        clearTimeout(hoverTimer.current);
        setPreviewing(null);
      }}
      onPress={() =>
        selecting ? onSelect?.(item.id) : router.push({ pathname: '/viewer', params: { id: item.id, scope } })
      }
      onLongPress={onSelect ? () => onSelect(item.id) : undefined}
      delayLongPress={350}
      accessibilityState={selecting ? { selected } : undefined}
      style={({ pressed }) => [radius > 0 && { borderRadius: radius, overflow: 'hidden' }, pressed && styles.pressed]}>
      <EditedImage
        // Thumbnails may be square crops, so edited photos (which may be cropped or
        // captioned) render from the full image to line up exactly.
        uri={edit && item.type === 'photo' ? item.uri : item.thumbUri}
        placeholderUri={edit ? item.thumbUri : undefined}
        sourceAspect={item.width / item.height}
        edit={edit}
        style={{ width: size, height }}
        recyclingKey={item.id}
      />
      {previewing === item.id && !selecting && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <VideoSurface item={item} contentFit="cover" muted loop />
        </View>
      )}
      <View style={styles.topRight}>
        {item.type === 'video' && <Icon ios="play.fill" android="play_arrow" size={16} color="#fff" />}
        {item.kind === 'live' && <Icon ios="livephoto" android="motion_photos_on" size={16} color="#fff" />}
        {item.kind === 'burst' && (
          <Icon ios="square.stack.3d.down.right" android="burst_mode" size={16} color="#fff" />
        )}
        {item.kind === 'screenshot' && (
          <Icon ios="camera.viewfinder" android="screenshot" size={14} color="#fff" />
        )}
      </View>
      {item.duration || burstCount ? (
        <Text style={[styles.badgeText, styles.bottomRight]}>
          {item.duration ? formatDuration(item.duration) : burstCount}
        </Text>
      ) : null}
      {liked && (
        <View style={styles.bottomLeft}>
          <Icon ios="heart.fill" android="favorite" size={14} color={LikeColor} />
        </View>
      )}
      {selecting && (
        <View style={[StyleSheet.absoluteFill, selected && styles.selectedTint]} pointerEvents="none">
          <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]}>
            {selected && <Icon ios="checkmark" android="check" size={14} color="#fff" />}
          </View>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  selectedTint: {
    backgroundColor: 'rgba(60,135,247,0.28)',
    borderWidth: 3,
    borderColor: '#3c87f7',
  },
  check: {
    position: 'absolute',
    top: Spacing.one + 2,
    left: Spacing.one + 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkOn: {
    backgroundColor: '#3c87f7',
    borderColor: '#fff',
  },
  checkOff: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderColor: 'rgba(255,255,255,0.9)',
  },
  topRight: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
  },
  bottomRight: {
    position: 'absolute',
    bottom: Spacing.one,
    right: Spacing.one,
  },
  bottomLeft: {
    position: 'absolute',
    bottom: Spacing.one,
    left: Spacing.one,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
});
