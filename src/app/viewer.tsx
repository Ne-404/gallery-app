import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionPicker } from '@/components/collection-picker';
import { EditedImage } from '@/components/edited-image';
import { Icon } from '@/components/icon';
import { ItemActions } from '@/components/item-actions';
import { TextPrompt } from '@/components/text-prompt';
import { VideoSurface } from '@/components/video-surface';
import { openInPlayer } from '@/lib/external-player';
import { Zoomable } from '@/components/zoomable';
import { LikeColor, Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import { useGallery } from '@/hooks/use-gallery';
import { formatDate } from '@/lib/dates';
import type { MediaItem, MediaKind } from '@/lib/media';
import type { Scope } from '@/lib/scopes';
import { setNote, toggleLike } from '@/lib/user-data';
import { isVaultScope, useVaultUnlocked } from '@/lib/vault';

const KIND_LABELS: Record<MediaKind, string> = {
  single: 'Photo',
  burst: 'Burst',
  live: 'Live Photo',
  video: 'Video',
  screenshot: 'Screenshot',
};

export default function ViewerScreen() {
  const { id, scope = 'all' } = useLocalSearchParams<{ id: string; scope?: Scope }>();
  const { library, data, scoped } = useGallery();
  const unlocked = useVaultUnlocked();
  const width = useAppWidth();
  // Pages need an explicit height: a horizontal list doesn't stretch its children on web,
  // which left every photo in a zero-height box (a black screen).
  const [pageHeight, setPageHeight] = useState(0);

  // Snapshot the list so un-liking inside "Liked" doesn't pull the photo out from under you.
  // It's taken once the library has loaded: opening the viewer by URL starts while it's
  // still empty, which used to leave a permanently black screen.
  const [snapshot, setSnapshot] = useState<MediaItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const live = scoped(scope);
  if (snapshot === null && library.items.length > 0) {
    const list = live.some((i) => i.id === id) ? live : library.items;
    setSnapshot(list);
    setIndex(Math.max(0, list.findIndex((i) => i.id === id)));
  }
  const items = snapshot ?? [];
  const [editingNote, setEditingNote] = useState(false);
  const [pickerItem, setPickerItem] = useState<string | null>(null);
  const [menuItem, setMenuItem] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  // A single tap hides the bars for an unobstructed view.
  const [chrome, setChrome] = useState(true);
  const heart = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value,
    transform: [{ scale: 0.6 + heart.value * 0.6 }],
  }));

  const current: MediaItem | undefined = items[index];
  if (isVaultScope(scope) && !unlocked) return <Redirect href="/vault" />;
  // Both branches measure: react-native-web only hooks up `onLayout` when a view mounts, and
  // this view is reused once the library finishes loading.
  const measure = (e: LayoutChangeEvent) => setPageHeight(e.nativeEvent.layout.height);
  if (!current) {
    return (
      <View style={styles.container} onLayout={measure}>
        <CloseButton />
      </View>
    );
  }

  const liked = !!data.likes[current.id];
  const note = data.notes[current.id];
  const saved = data.collections.some((c) => c.items.some((e) => e.id === current.id));

  const like = () => {
    const nowLiked = toggleLike(current.id);
    if (nowLiked) {
      heart.set(withSequence(withSpring(1), withTiming(0, { duration: 400 })));
    } else {
    }
  };


  return (
    <View style={styles.container} onLayout={measure}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        // Cells only re-render when this changes, so it includes the measured page height.
        extraData={[data, pageHeight, index]}
        horizontal
        // While zoomed, a drag moves around the photo instead of paging.
        scrollEnabled={!zoomed}
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        windowSize={3}
        renderItem={({ item, index: i }) => (
          <View style={{ width, height: pageHeight }}>
            {item.type === 'video' && data.settings.videoPlayer === 'external' ? (
              <ExternalVideo item={item} />
            ) : item.type === 'video' && i === index ? (
              <VideoSurface
                item={item}
                contentFit="contain"
                nativeControls
                minimal={data.settings.videoPlayer === 'minimal'}
                loop
              />
            ) : (
              <Zoomable
                width={width}
                height={pageHeight}
                onZoomChange={setZoomed}
                onSingleTap={() => setChrome((c) => !c)}>
                <EditedImage
                  uri={item.uri}
                  placeholderUri={item.thumbUri}
                  edit={data.edits[item.id]}
                  sourceAspect={item.width / item.height}
                  style={styles.fill}
                  contentFit="contain"
                  // The photo on screen loads first; its neighbours are preloaded quietly.
                  priority={i === index ? 'high' : 'low'}
                  transition={120}
                />
              </Zoomable>
            )}
          </View>
        )}
      />

      <Animated.View pointerEvents="none" style={[styles.heartBurst, heartStyle]}>
        <Icon ios="heart.fill" android="favorite" size={110} color="#fff" />
      </Animated.View>

      <SafeAreaView
        style={[styles.topBar, !chrome && styles.hidden]}
        edges={['top']}
        pointerEvents={chrome ? 'box-none' : 'none'}>
        <CloseButton />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {data.titles[current.id] ??
              (data.settings.hideDates ? KIND_LABELS[current.kind] : formatDate(current.createdAt))}
          </Text>
          <Text style={styles.subtitle}>
            {data.settings.hideDates ? '' : `${KIND_LABELS[current.kind]} · `}
            {index + 1} of {items.length}
          </Text>
        </View>
        <Pressable
          onPress={() => setMenuItem(current.id)}
          accessibilityLabel="More options"
          hitSlop={Spacing.three}
          style={({ pressed }) => [styles.iconButton, styles.closeButton, pressed && styles.pressed]}>
          <Icon ios="ellipsis" android="more_vert" size={18} color="#fff" />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView
        style={[styles.bottomBar, !chrome && styles.hidden]}
        edges={['bottom']}
        pointerEvents={chrome ? 'box-none' : 'none'}>
        {note && (
          <Pressable onPress={() => setEditingNote(true)} style={styles.note}>
            <Text style={styles.noteText} numberOfLines={3}>
              {note.text}
            </Text>
          </Pressable>
        )}
        <View style={styles.actions}>
          <ActionButton onPress={like} label={liked ? 'Liked' : 'Like'}>
            <Icon
              ios={liked ? 'heart.fill' : 'heart'}
              android={liked ? 'favorite' : 'favorite_border'}
              size={26}
              color={liked ? LikeColor : '#fff'}
            />
          </ActionButton>
          <ActionButton onPress={() => setEditingNote(true)} label={note ? 'Edit note' : 'Note'}>
            <Icon
              ios={note ? 'text.bubble.fill' : 'text.bubble'}
              android="chat_bubble"
              size={24}
              color="#fff"
            />
          </ActionButton>
          {current.type === 'photo' && (
            <ActionButton
              onPress={() => router.push({ pathname: '/editor', params: { id: current.id } })}
              label="Edit">
              <Icon ios="slider.horizontal.3" android="tune" size={24} color="#fff" />
            </ActionButton>
          )}
          <ActionButton onPress={() => setPickerItem(current.id)} label={saved ? 'Saved' : 'Save'}>
            <Icon
              ios={saved ? 'bookmark.fill' : 'bookmark'}
              android={saved ? 'bookmark' : 'bookmark_border'}
              size={24}
              color="#fff"
            />
          </ActionButton>
        </View>
      </SafeAreaView>

      <TextPrompt
        visible={editingNote}
        title="Private note"
        placeholder="What do you remember about this moment?"
        initialValue={note?.text}
        submitLabel="Save note"
        multiline
        onClose={() => setEditingNote(false)}
        onSubmit={(text) => {
          setNote(current.id, text);
        }}
      />
      <CollectionPicker itemId={pickerItem} onClose={() => setPickerItem(null)} />
      <ItemActions
        itemId={menuItem}
        onClose={() => setMenuItem(null)}
        onRemoved={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </View>
  );
}

/** "Another app" mode: the poster frame with a button that hands the video to a player app. */
function ExternalVideo({ item }: { item: MediaItem }) {
  return (
    <View style={styles.fill}>
      <Image source={{ uri: item.thumbUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      <View style={styles.externalCenter}>
        <Pressable
          onPress={() => openInPlayer(item).catch((error) => console.warn('Could not open player', error))}
          accessibilityLabel="Play in another app"
          style={({ pressed }) => [styles.externalButton, pressed && styles.pressed]}>
          <Icon ios="play.rectangle.fill" android="open_in_new" size={22} color="#000" />
          <Text style={styles.externalText}>Play in another app</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CloseButton() {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={Spacing.three}
      style={({ pressed }) => [styles.iconButton, styles.closeButton, pressed && styles.pressed]}>
      <Icon ios="xmark" android="close" size={18} color="#fff" />
    </Pressable>
  );
}

function ActionButton({
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
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      {children}
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fill: {
    flex: 1,
  },
  externalCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  externalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  externalText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 700,
  },
  hidden: {
    opacity: 0,
  },
  heartBurst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  titleBlock: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
  },
  closeButton: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: Spacing.two,
  },
  note: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  noteText: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: Spacing.two,
  },
  action: {
    alignItems: 'center',
    gap: Spacing.half,
    minWidth: 72,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.6,
  },
});
