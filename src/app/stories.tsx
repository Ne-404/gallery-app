import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ReelPlayer } from '@/components/reel-player';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useT } from '@/lib/i18n';
import type { Reel } from '@/lib/reels';
import { createCollection, toggleInCollection } from '@/lib/user-data';

/** A reel counts as the current one once it fills most of the screen. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/** Plays the user's stories full screen (opened from the Profile stories row). */
export default function StoriesScreen() {
  const { reels, unlocked, data } = useGallery();
  const accent = useAccent();
  const t = useT();
  const { reel: requestedReel } = useLocalSearchParams<{ reel?: string }>();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Reel>>(null);
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  // Follows whichever reel is on screen (a momentum-end event missed wheel scrolling on web
  // and slow drags). FlatList requires this handler to never change, so it's created once.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const page = viewableItems[0]?.index;
    if (page != null) setActiveIndex(page);
  });
  const [savedReels, setSavedReels] = useState<string[]>([]);

  // Jump to the reel tapped in the feed or opened from a notification.
  const [handledRequest, setHandledRequest] = useState<string>();
  const requestedIndex = reels.findIndex((r) => r.id === requestedReel);
  if (requestedReel !== handledRequest && requestedIndex >= 0) {
    setHandledRequest(requestedReel);
    setActiveIndex(requestedIndex);
  }
  // Also re-run when the page height changes (the phone rotated), so the same reel stays on screen.
  useEffect(() => {
    if (height && activeIndex < reels.length) {
      listRef.current?.scrollToIndex({ index: activeIndex, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedReel, height]);

  const saveReel = (reel: Reel) => {
    const id = createCollection(reel.title);
    // Add in reverse so the collection keeps the reel's order (newest-added first).
    for (const item of [...reel.items].reverse()) toggleInCollection(id, item.id);
    setSavedReels((s) => [...s, reel.id]);
  };

  if (reels.length === 0) {
    return (
      <ThemedView style={styles.empty}>
        <Icon ios="film.stack" android="movie" size={40} />
        <ThemedText type="subtitle">{t('No stories yet')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          {t('Make a story from your photos and it plays here.')}
        </ThemedText>
        <Pressable
          onPress={() => router.push('/story')}
          style={({ pressed }) => [styles.saveButton, styles.createButton, { backgroundColor: accent }, pressed && styles.pressed]}>
          <Icon ios="plus" android="add" size={16} color="#fff" />
          <ThemedText type="smallBold" style={styles.saveText}>
            {t('New story')}
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && (
        <FlatList
          ref={listRef}
          data={reels}
          keyExtractor={(reel) => reel.id}
          extraData={`${activeIndex}:${focused}:${savedReels.join()}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          // Each page is a full-screen story: keep only the neighbours mounted.
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          viewabilityConfig={VIEWABILITY}
          onViewableItemsChanged={onViewable}
          renderItem={({ item: reel, index }) => (
            <ReelPlayer
              reel={reel}
              height={height}
              active={focused && index === activeIndex}
              cinematic={unlocked.cinematic}
              topInset={insets.top}
              bottomInset={insets.bottom + Spacing.three}
              hideDates={data.settings.hideDates}
              footer={
                <View style={styles.footer}>
                <Pressable
                  onPress={() => router.push({ pathname: '/story', params: { id: reel.id } })}
                  style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                  <Icon ios="pencil" android="edit" size={16} color="#fff" />
                  <ThemedText type="smallBold" style={styles.saveText}>
                    {t('Edit story')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  disabled={savedReels.includes(reel.id)}
                  onPress={() => saveReel(reel)}
                  style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                  <Icon
                    ios={savedReels.includes(reel.id) ? 'checkmark' : 'bookmark'}
                    android={savedReels.includes(reel.id) ? 'check' : 'bookmark_border'}
                    size={16}
                    color="#fff"
                  />
                  <ThemedText type="smallBold" style={styles.saveText}>
                    {savedReels.includes(reel.id) ? t('Moved to vault') : t('Save to vault')}
                  </ThemedText>
                </Pressable>
                </View>
              }
            />
          )}
        />
      )}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        accessibilityLabel={t('Close stories')}
        hitSlop={12}
        style={[styles.close, { top: insets.top + Spacing.four }]}>
        <Icon ios="xmark" android="close" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  emptyText: {
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  close: {
    position: 'absolute',
    end: Spacing.three,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  createButton: {
    alignSelf: 'center',
  },
  saveText: {
    color: '#fff',
  },
  pressed: {
    opacity: 0.7,
  },
});
