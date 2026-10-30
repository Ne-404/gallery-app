import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumsOverview } from '@/components/albums-overview';
import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ItemActions } from '@/components/item-actions';
import { LibraryBanner } from '@/components/library-banner';
import { MediaGrid } from '@/components/media-grid';
import { PinCard } from '@/components/pin-card';
import { TextPrompt } from '@/components/text-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxFeedWidth, Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TKey } from '@/lib/i18n';
import { loadLibrary, type MediaItem } from '@/lib/media';
import { setNote } from '@/lib/user-data';

const PAGE_SIZE = 40;
/** Space between and around the feed's columns. */
const FEED_GAP = Spacing.two;
/** Phones get two columns; wider screens add one per this much width. */
const MIN_COLUMN_WIDTH = 260;
const SWITCHER_HEIGHT = 56;

type Layout = 'feed' | 'grid' | 'albums';

const LAYOUTS: { id: Layout; label: TKey; ios: 'square.grid.2x2' | 'square.grid.3x3' | 'rectangle.stack'; android: 'dashboard' | 'grid_on' | 'photo_library' }[] = [
  { id: 'feed', label: 'Feed', ios: 'square.grid.2x2', android: 'dashboard' },
  { id: 'grid', label: 'Grid', ios: 'square.grid.3x3', android: 'grid_on' },
  { id: 'albums', label: 'Albums', ios: 'rectangle.stack', android: 'photo_library' },
];

export default function HomeScreen() {
  const { library, data, scoped, burstCounts } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  const width = useAppWidth();
  // A Pinterest-style masonry: two columns on phones, more on wide screens.
  const columns = Math.max(2, Math.floor(width / MIN_COLUMN_WIDTH));
  const pinWidth = (width - FEED_GAP * (columns + 1)) / columns;
  const [layout, setLayout] = useState<Layout>('feed');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [noteItem, setNoteItem] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Tapping the Home tab while already on Home scrolls the feed back to the top.
  const feed = useRef<FlashListRef<MediaItem>>(null);
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('tabPress' as never, () => {
        if (navigation.isFocused()) feed.current?.scrollToOffset({ offset: 0, animated: true });
      }),
    [navigation]
  );
  // Multi-select happens in the grid; starting it from the feed switches to the grid.
  const [gridSelecting, setGridSelecting] = useState(false);
  const [selectSeed, setSelectSeed] = useState<{ id: string; n: number } | null>(null);
  const startSelecting = (itemId: string) => {
    setLayout('grid');
    setSelectSeed((s) => ({ id: itemId, n: (s?.n ?? 0) + 1 }));
  };

  const items = scoped('all');

  // The view switcher floats over the list; once content scrolls under it, it turns
  // 80% transparent (with a blur) so the photos show through.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > 4;
    if (next !== scrolled) setScrolled(next);
  };
  const listHeader = (
    <View style={styles.header}>
      <LibraryBanner />
    </View>
  );

  const switcher = (
    <View style={[styles.switcherBar, !scrolled && { backgroundColor: theme.background }]} pointerEvents="box-none">
      <View
        style={[
          styles.switcher,
          { backgroundColor: scrolled ? `${theme.backgroundElement}33` : theme.backgroundElement },
          scrolled && theme.outline > 0 && { borderWidth: theme.outline, borderColor: `${theme.border}66` },
        ]}>
        {scrolled && <BlurView intensity={28} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        {LAYOUTS.map((option) => {
          const active = layout === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('{name} view', { name: t(option.label) })}
              onPress={() => {
                setLayout(option.id);
                setScrolled(false);
              }}
              style={[
                styles.switchOption,
                active && {
                  backgroundColor: theme.brutal ? accent : scrolled ? `${theme.background}99` : theme.background,
                },
                active && theme.outline > 0 && { borderWidth: 2, borderColor: theme.border },
              ]}>
              <Icon
                ios={option.ios}
                android={option.android}
                size={18}
                color={active ? (theme.brutal ? '#000' : accent) : theme.textSecondary}
              />
              <ThemedText
                type="smallBold"
                style={[styles.switchLabel, { color: active ? theme.text : theme.textSecondary }]}>
                {t(option.label)}
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
        <AppBar
          title={t('Gally-ri')}
          brand
          actions={
            <>
              <IconButton label={t('Search')} onPress={() => router.push('/search')}>
                <Icon ios="magnifyingglass" android="search" />
              </IconButton>
              <IconButton
                label={t('Liked')}
                onPress={() => router.push({ pathname: '/album', params: { scope: 'liked' } })}>
                <Icon ios="heart" android="favorite_border" />
              </IconButton>
            </>
          }
        />

        <View style={styles.container}>
        {library.status === 'loading' && library.items.length === 0 ? (
          <ActivityIndicator style={styles.container} />
        ) : layout === 'albums' ? (
          <AlbumsOverview header={listHeader} onScroll={onScroll} />
        ) : layout === 'grid' ? (
          <MediaGrid
            items={items}
            scope="all"
            columns={4}
            masonry
            likes={data.likes}
            edits={data.edits}
            burstCounts={burstCounts}
            header={listHeader}
            onScroll={onScroll}
            key={selectSeed ? `select-${selectSeed.n}` : 'grid'}
            onRefresh={loadLibrary}
            refreshing={library.status === 'loading'}
            initialSelected={selectSeed ? [selectSeed.id] : undefined}
            onSelectingChange={setGridSelecting}
          />
        ) : (
          <FlashList
            ref={feed}
            key={columns}
            data={items.slice(0, visibleCount)}
            keyExtractor={(item) => item.id}
            extraData={data}
            masonry
            numColumns={columns}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ ...styles.feed, paddingHorizontal: FEED_GAP / 2 }}
            // Pull down to rescan the photo library.
            onRefresh={loadLibrary}
            refreshing={library.status === 'loading' && library.items.length > 0}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onEndReached={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length))}
            onEndReachedThreshold={2}
            renderItem={({ item }) => (
              <View style={styles.pin}>
                <PinCard
                  item={item}
                  scope="all"
                  width={pinWidth}
                  edit={data.edits[item.id]}
                  liked={!!data.likes[item.id]}
                  note={data.notes[item.id]}
                  title={data.titles[item.id]}
                  onNote={setNoteItem}
                  onMore={setMenuItem}
                  onSelect={startSelecting}
                />
              </View>
            )}
          />
        )}
        {!(layout === 'grid' && gridSelecting) && switcher}
        </View>
      </SafeAreaView>

      <TextPrompt
        visible={noteItem !== null}
        title={t('Private note')}
        placeholder={t('What do you remember about this moment?')}
        initialValue={noteItem ? data.notes[noteItem]?.text : ''}
        submitLabel={t('Save note')}
        multiline
        onClose={() => setNoteItem(null)}
        onSubmit={(text) => {
          if (!noteItem) return;
          setNote(noteItem, text);
        }}
      />
      <ItemActions itemId={menuItem} onClose={() => setMenuItem(null)} onSelect={startSelecting} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Leaves room for the floating view switcher above the first item.
  header: {
    paddingTop: SWITCHER_HEIGHT,
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  switcherBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  feed: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  pin: {
    paddingHorizontal: FEED_GAP / 2,
  },
  switcher: {
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
    maxWidth: MaxFeedWidth - Spacing.three * 2,
    padding: Spacing.one,
    borderRadius: Spacing.four,
    gap: Spacing.one,
  },
  switchOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    height: 36,
    borderRadius: Spacing.three,
  },
  switchLabel: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
});
