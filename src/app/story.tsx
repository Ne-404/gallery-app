import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { confirmAction } from '@/lib/ui';
import { createStory, deleteStory, updateStory } from '@/lib/user-data';

/** Columns on a phone; tablets add more so tiles stay thumbnail-sized. */
const COLUMNS = 4;
const GAP = 2;

/** Create or edit a story: its title and which photos it plays, in order. */
export default function StoryEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { library, data } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const width = useAppWidth();
  const t = useT();
  const story = data.stories.find((s) => s.id === id);
  const [title, setTitle] = useState(story?.title ?? '');
  const [selected, setSelected] = useState<string[]>(story?.itemIds ?? []);
  const columns = Math.max(COLUMNS, Math.round(width / 100));
  const tile = (width - GAP * (columns - 1)) / columns;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const toggle = (itemId: string) => {
    setSelected((s) => (s.includes(itemId) ? s.filter((x) => x !== itemId) : [...s, itemId]));
  };
  const canSave = selected.length > 0;
  const save = () => {
    if (!canSave) return;
    if (story) updateStory(story.id, { title: title.trim() || story.title, itemIds: selected });
    else createStory(title.trim() || t('Story'), selected);
    close();
  };

  const header = (
    <View style={styles.header}>
      <ThemedView type="backgroundElement" style={styles.field}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('Story title')}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={t('Story title')}
          maxLength={40}
          style={[styles.input, { color: theme.text }, noFocusRing]}
        />
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary">
        {selected.length
          ? t('{n} selected · they play in the order you tap them, and the first is the cover.', { n: selected.length })
          : t('Tap photos and videos to add them to this story.')}
      </ThemedText>
      {story && (
        <Pressable
          onPress={() =>
            confirmAction(t('Delete “{name}”?', { name: story.title }), t('The photos themselves stay in your gallery.'), t('Delete'), () => {
              deleteStory(story.id);
              close();
            })
          }
          accessibilityLabel={t('Delete story')}
          style={styles.delete}>
          <Icon ios="trash" android="delete" size={16} color="#E5484D" />
          <ThemedText type="smallBold" style={styles.deleteText}>
            {t('Delete story')}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title={story ? t('Edit story') : t('New story')}
          leading="close"
          actions={
            <IconButton label={t('Save story')} onPress={save}>
              <Icon ios="checkmark" android="check" color={canSave ? accent : theme.textSecondary} />
            </IconButton>
          }
        />
        <FlatList
          data={library.items}
          keyExtractor={(item) => item.id}
          // numColumns can't change on a mounted list.
          key={columns}
          numColumns={columns}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={header}
          extraData={selected}
          // Rows, not tiles (numColumns): one screenful, so opening doesn't load every thumbnail.
          initialNumToRender={8}
          windowSize={3}
          renderItem={({ item }) => {
            const order = selected.indexOf(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                accessibilityLabel={
                  item.type === 'video'
                    ? order >= 0 ? t('Remove video') : t('Add video')
                    : order >= 0 ? t('Remove photo') : t('Add photo')
                }
                style={{ width: tile, height: tile }}>
                <Image source={{ uri: item.thumbUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {order >= 0 && <View style={[StyleSheet.absoluteFill, styles.dim]} />}
                {item.type === 'video' && (
                  <View style={styles.video}>
                    <Icon ios="play.fill" android="play_arrow" size={14} color="#fff" />
                  </View>
                )}
                <View
                  style={[
                    styles.badge,
                    order >= 0 ? { backgroundColor: accent, borderColor: '#fff' } : styles.badgeEmpty,
                  ]}>
                  {order >= 0 && <ThemedText style={styles.badgeText}>{order + 1}</ThemedText>}
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const noFocusRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  field: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  input: {
    fontSize: 17,
    fontWeight: 600,
    paddingVertical: Spacing.three,
  },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  deleteText: {
    color: '#E5484D',
  },
  gridRow: {
    gap: GAP,
    marginBottom: GAP,
  },
  dim: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  video: {
    position: 'absolute',
    left: 4,
    bottom: 4,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmpty: {
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 700,
  },
});
