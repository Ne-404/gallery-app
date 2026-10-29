import { router } from 'expo-router';
import { useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumsOverview } from '@/components/albums-overview';
import { AppBar, IconButton } from '@/components/app-bar';
import { CollectionPicker } from '@/components/collection-picker';
import { Icon } from '@/components/icon';
import { ItemActions } from '@/components/item-actions';
import { LibraryBanner } from '@/components/library-banner';
import { MediaGrid } from '@/components/media-grid';
import { PostCard } from '@/components/post-card';
import { TextPrompt } from '@/components/text-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { scopeItems } from '@/lib/scopes';
import { setNote } from '@/lib/user-data';

const PAGE_SIZE = 12;
const SWITCHER_HEIGHT = 56;

type Layout = 'feed' | 'grid' | 'albums';

const LAYOUTS: { id: Layout; label: string; ios: 'rectangle.grid.1x2' | 'square.grid.3x3' | 'rectangle.stack'; android: 'view_agenda' | 'grid_on' | 'photo_library' }[] = [
  { id: 'feed', label: 'Feed', ios: 'rectangle.grid.1x2', android: 'view_agenda' },
  { id: 'grid', label: 'Grid', ios: 'square.grid.3x3', android: 'grid_on' },
  { id: 'albums', label: 'Albums', ios: 'rectangle.stack', android: 'photo_library' },
];

export default function HomeScreen() {
  const { library, data } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const width = useAppWidth();
  const [layout, setLayout] = useState<Layout>('feed');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [noteItem, setNoteItem] = useState<string | null>(null);
  const [saveItem, setSaveItem] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Multi-select happens in the grid; starting it from the feed switches to the grid.
  const [gridSelecting, setGridSelecting] = useState(false);
  const [selectSeed, setSelectSeed] = useState<{ id: string; n: number } | null>(null);
  const startSelecting = (itemId: string) => {
    setLayout('grid');
    setSelectSeed((s) => ({ id: itemId, n: (s?.n ?? 0) + 1 }));
  };

  const items = scopeItems('all', library.items, data);
  const saved = new Set(data.collections.flatMap((c) => c.items.map((e) => e.id)));
  const burstCounts = new Map<string, number>();
  for (const item of library.items) {
    if (item.burstId) burstCounts.set(item.burstId, (burstCounts.get(item.burstId) ?? 0) + 1);
  }

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
              accessibilityLabel={`${option.label} view`}
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
                {option.label}
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
          title="Gallery"
          brand
          actions={
            <>
              <IconButton label="Search" onPress={() => router.push('/search')}>
                <Icon ios="magnifyingglass" android="search" />
              </IconButton>
              <IconButton
                label="Liked"
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
            likes={data.likes}
            edits={data.edits}
            burstCounts={burstCounts}
            header={listHeader}
            onScroll={onScroll}
            key={selectSeed ? `select-${selectSeed.n}` : 'grid'}
            initialSelected={selectSeed ? [selectSeed.id] : undefined}
            onSelectingChange={setGridSelecting}
          />
        ) : (
          <FlatList
            data={items.slice(0, visibleCount)}
            keyExtractor={(item) => item.id}
            extraData={data}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.feed}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onEndReached={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length))}
            onEndReachedThreshold={2}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item }) => (
              <PostCard
                item={item}
                scope="all"
                width={width}
                edit={data.edits[item.id]}
                liked={!!data.likes[item.id]}
                saved={saved.has(item.id)}
                note={data.notes[item.id]}
                hideDates={data.settings.hideDates}
                onNote={setNoteItem}
                onSave={setSaveItem}
                title={data.titles[item.id]}
                onMore={setMenuItem}
                onSelect={startSelecting}
              />
            )}
          />
        )}
        {!(layout === 'grid' && gridSelecting) && switcher}
        </View>
      </SafeAreaView>

      <TextPrompt
        visible={noteItem !== null}
        title="Private note"
        placeholder="What do you remember about this moment?"
        initialValue={noteItem ? data.notes[noteItem]?.text : ''}
        submitLabel="Save note"
        multiline
        onClose={() => setNoteItem(null)}
        onSubmit={(text) => {
          if (!noteItem) return;
          setNote(noteItem, text);
        }}
      />
      <CollectionPicker itemId={saveItem} onClose={() => setSaveItem(null)} />
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
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  feed: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  switcher: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginHorizontal: Spacing.three,
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
