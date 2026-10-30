import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { AlbumCard } from '@/components/album-card';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { TextPrompt } from '@/components/text-prompt';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';
import { buildAlbums, type Album } from '@/lib/scopes';
import { confirmAction } from '@/lib/ui';
import { showToast } from '@/lib/toast';
import { createFolder, deleteFolder, setFolderHidden } from '@/lib/user-data';

/**
 * Folders, smart albums, Recently deleted and years. Shown on the Albums page and Home. The
 * vault is only reached from the side panel.
 */
export function AlbumsOverview({
  header,
  onScroll,
}: {
  header?: ReactNode;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { library, data, trashCount } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  const [naming, setNaming] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [options, setOptions] = useState<Album | null>(null);
  const albums = buildAlbums(library.items, data, t);
  const hiddenIds = new Set(data.folders.filter((f) => f.hidden).map((f) => `folder:${f.id}`));
  const folders = albums.folders.filter((album) => showHidden || !hiddenIds.has(album.scope));
  const optionsHidden = !!options && hiddenIds.has(options.scope);

  const open = (album: Album) => router.push({ pathname: '/album', params: { scope: album.scope } });

  return (
    <ScrollView contentContainerStyle={styles.content} onScroll={onScroll} scrollEventThrottle={32}>
      {header}
      <View style={styles.body}>
        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold" style={[styles.sectionTitle, styles.flex]}>
            {t('Folders')}
          </ThemedText>
          {hiddenIds.size > 0 && (
            <Pressable onPress={() => setShowHidden((s) => !s)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" style={[styles.sectionTitleAction, { color: accent }]}>
                {showHidden ? t('Hide hidden') : t('Show hidden ({n})', { n: hiddenIds.size })}
              </ThemedText>
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
          <Pressable
            onPress={() => setNaming(true)}
            accessibilityLabel={t('New folder')}
            style={({ pressed }) => pressed && styles.pressed}>
            <View style={[styles.newFolder, { borderColor: theme.backgroundSelected }]}>
              <Icon ios="folder.badge.plus" android="create_new_folder" size={30} color={accent} />
              <ThemedText type="smallBold" style={{ color: accent }}>
                {t('New folder')}
              </ThemedText>
            </View>
          </Pressable>
          {folders.map((album) => (
            <View key={album.scope} style={hiddenIds.has(album.scope) && styles.hiddenFolder}>
              <AlbumCard album={album} size={120} onPress={() => open(album)} onLongPress={() => setOptions(album)} />
            </View>
          ))}
        </ScrollView>

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          {t('Media types')}
        </ThemedText>
        <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
          {[
            ...albums.smart,
            {
              scope: 'trash' as const,
              title: t('Recently deleted'),
              items: [],
              icon: { ios: 'trash' as const, android: 'delete' as const },
            },
          ].map((album, i) => (
            <Pressable
              key={album.scope}
              onPress={() => open(album)}
              style={({ pressed }) => [
                styles.listRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <Icon {...album.icon} color={accent} />
              <ThemedText style={styles.flex}>{album.title}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {album.scope === 'trash' ? trashCount : album.items.length}
              </ThemedText>
              <Icon ios="chevron.right" android="chevron_right" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          {t('By year')}
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
          {albums.years.map((album) => (
            <AlbumCard key={album.scope} album={album} size={120} onPress={() => open(album)} />
          ))}
        </ScrollView>
      </View>
      <Sheet visible={!!options} title={options?.title ?? ''} onClose={() => setOptions(null)}>
        {options && (
          <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
            <Pressable
              onPress={() => {
                setFolderHidden(options.scope.replace('folder:', ''), !optionsHidden);
                if (!optionsHidden) showToast(t('“{name}” hidden from Albums', { name: options.title }));
                setOptions(null);
              }}
              style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
              <Icon
                ios={optionsHidden ? 'eye' : 'eye.slash'}
                android={optionsHidden ? 'visibility' : 'visibility_off'}
                color={accent}
              />
              <ThemedText style={styles.flex}>{optionsHidden ? t('Unhide album') : t('Hide album')}</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                const album = options;
                setOptions(null);
                confirmAction(t('Delete “{name}”?', { name: album.title }), t('Only the folder is removed; its photos stay in your gallery.'), t('Delete'), () =>
                  deleteFolder(album.scope.replace('folder:', ''))
                );
              }}
              style={({ pressed }) => [
                styles.listRow,
                { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <Icon ios="trash" android="delete" color="#E5484D" />
              <ThemedText style={[styles.flex, { color: '#E5484D' }]}>{t('Delete album')}</ThemedText>
            </Pressable>
          </View>
        )}
      </Sheet>
      <TextPrompt
        visible={naming}
        title={t('New folder')}
        placeholder={t('e.g. Trip to Rome')}
        submitLabel={t('Create')}
        onClose={() => setNaming(false)}
        onSubmit={(name) => {
          const id = createFolder(name.trim() || t('New folder'));
          router.push({ pathname: '/album', params: { scope: `folder:${id}` } });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: BottomTabInset + Spacing.five,
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitleAction: {
    marginTop: Spacing.two,
  },
  hiddenFolder: {
    opacity: 0.5,
  },
  list: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  years: {
    gap: Spacing.three,
  },
  newFolder: {
    width: 120,
    height: 120,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
