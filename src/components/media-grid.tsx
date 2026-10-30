import { FlashList } from '@shopify/flash-list';
import { useEffect, useRef, useState, type ComponentRef, type ReactElement } from 'react';
import { FlatList, Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { GestureDetector, usePinchGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MediaTile } from '@/components/media-tile';
import { pinRatio } from '@/components/pin-card';
import { SelectionBar } from '@/components/selection-bar';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import type { Edit } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';
import type { Scope } from '@/lib/scopes';

const GAP = 1.5;
/** Masonry tiles are rounded cards with more room between them, like the feed. */
const MASONRY_GAP = 4;
const MASONRY_RADIUS = 8;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;
/** `columns` is the count for a phone this wide; wider screens get proportionally more. */
const PHONE_WIDTH = 430;
const PAGE_SIZE = 90;

type MediaGridProps = {
  items: MediaItem[];
  scope: Scope;
  likes: Record<string, number>;
  edits: Record<string, Edit>;
  columns?: number;
  /**
   * Pinterest-style: each tile keeps its photo's shape and the columns interleave (same
   * column count and pinch as the square grid).
   */
  masonry?: boolean;
  /** Frame counts per burst id, for the badge on collapsed burst tiles. */
  burstCounts?: Map<string, number>;
  header?: ReactElement;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  empty?: ReactElement;
  /** Starts in selection mode with these items selected (e.g. "Select" from a photo menu). */
  initialSelected?: string[];
  /** Lets the screen hide its own overlays while the selection bar is showing. */
  onSelectingChange?: (selecting: boolean) => void;
  /** Pull to refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
};

/** Compact, Instagram-style infinite grid; renders in pages so huge libraries stay fast. */
export function MediaGrid({
  items,
  scope,
  likes,
  edits,
  columns: phoneColumns = 3,
  masonry = false,
  burstCounts,
  header,
  onScroll,
  empty,
  initialSelected,
  onSelectingChange,
  onRefresh,
  refreshing = false,
}: MediaGridProps) {
  const width = useAppWidth();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Press and hold a photo to start selecting; null when not in selection mode.
  const [selected, setSelected] = useState<string[] | null>(initialSelected ?? null);
  // Tablets and wide windows keep tiles about phone-sized by adding columns.
  const scale = Math.max(1, width / PHONE_WIDTH);
  const columns = Math.round(phoneColumns * scale);
  const maxColumns = Math.round(MAX_COLUMNS * scale);
  // Pinch with two fingers to change the column count: spread for bigger tiles, pinch for more.
  // The pinch is kept as an offset, so resizing the window or rotating keeps it.
  const [offset, setOffset] = useState(0);
  const cols = Math.min(maxColumns, Math.max(MIN_COLUMNS, columns + offset));
  const changeColumns = (step: number) =>
    setOffset((o) => Math.min(maxColumns - columns, Math.max(MIN_COLUMNS - columns, o + step)));
  const pinch = usePinchGesture({
    onDeactivate: (e) => {
      'worklet';
      if (e.scale > 1.18) scheduleOnRN(changeColumns, -1);
      else if (e.scale < 0.85) scheduleOnRN(changeColumns, 1);
    },
  });
  // Trackpad pinches arrive as ctrl+wheel in browsers; one step per gesture. A native,
  // non-passive listener: React's onWheel is passive, so it couldn't stop the browser's
  // own page zoom.
  const frame = useRef<ComponentRef<typeof View>>(null);
  const lastWheel = useRef(0);
  useEffect(() => {
    const element = frame.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !element?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 4 || Date.now() - lastWheel.current < 450) return;
      lastWheel.current = Date.now();
      const step = e.deltaY < 0 ? -1 : 1;
      setOffset((o) => Math.min(maxColumns - columns, Math.max(MIN_COLUMNS - columns, o + step)));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [columns, maxColumns]);
  const tileSize = masonry ? (width - MASONRY_GAP) / cols - MASONRY_GAP : (width - GAP * (cols - 1)) / cols;
  const selecting = selected !== null;
  const selectedSet = new Set(selected);

  useEffect(() => {
    onSelectingChange?.(selecting);
  }, [selecting, onSelectingChange]);

  // A functional update keeps `toggle` stable, so memoized tiles don't all re-render.
  const toggle = (itemId: string) =>
    setSelected((current) =>
      current === null ? [itemId] : current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );

  return (
    <GestureDetector gesture={pinch}>
    <View ref={frame} style={styles.container}>
    <Animated.View key={cols} entering={FadeIn.duration(180)} style={styles.container}>
    {masonry ? (
    <FlashList
      data={items.slice(0, visibleCount)}
      keyExtractor={(item) => item.id}
      extraData={[likes, edits, selected]}
      masonry
      numColumns={cols}
      onRefresh={onRefresh}
      refreshing={refreshing}
      contentContainerStyle={styles.masonryContent}
      ListHeaderComponent={header}
      onScroll={onScroll}
      scrollEventThrottle={32}
      ListEmptyComponent={empty}
      onEndReached={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length))}
      onEndReachedThreshold={1.5}
      renderItem={({ item }) => (
        <View style={styles.masonryCell}>
          <MediaTile
            item={item}
            size={tileSize}
            height={tileSize / pinRatio(item, edits[item.id])}
            radius={MASONRY_RADIUS}
            liked={!!likes[item.id]}
            edit={edits[item.id]}
            burstCount={item.burstId ? burstCounts?.get(item.burstId) : undefined}
            scope={scope}
            selecting={selecting}
            selected={selectedSet.has(item.id)}
            onSelect={toggle}
          />
        </View>
      )}
    />
    ) : (
    <FlatList
      data={items.slice(0, visibleCount)}
      keyExtractor={(item) => item.id}
      extraData={[likes, edits, selected]}
      numColumns={cols}
      onRefresh={onRefresh}
      refreshing={refreshing}
      // With numColumns these count rows, not tiles: 12 rows fill the screen even at 6 columns.
      maxToRenderPerBatch={6}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      onScroll={onScroll}
      scrollEventThrottle={32}
      ListEmptyComponent={empty}
      onEndReached={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length))}
      onEndReachedThreshold={1.5}
      initialNumToRender={12}
      windowSize={5}
      removeClippedSubviews
      renderItem={({ item }) => (
        <MediaTile
          item={item}
          size={tileSize}
          liked={!!likes[item.id]}
          edit={edits[item.id]}
          burstCount={item.burstId ? burstCounts?.get(item.burstId) : undefined}
          scope={scope}
          selecting={selecting}
          selected={selectedSet.has(item.id)}
          onSelect={toggle}
        />
      )}
    />
    )}
    </Animated.View>
    {selecting && (
      <SelectionBar
        selected={selected}
        scope={scope}
        allIds={items.map((i) => i.id)}
        onChange={setSelected}
      />
    )}
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    gap: GAP,
  },
  content: {
    gap: GAP,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  masonryContent: {
    paddingHorizontal: MASONRY_GAP / 2,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  masonryCell: {
    paddingHorizontal: MASONRY_GAP / 2,
    paddingBottom: MASONRY_GAP,
  },
});
