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
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { buildAlbums, type Album } from '@/lib/scopes';
import { confirmAction } from '@/lib/ui';
import { showToast } from '@/lib/toast';
import { createFolder, deleteFolder, setFolderHidden } from '@/lib/user-data';
import { useVaultUnlocked } from '@/lib/vault';

/** The vault, smart albums, Recently deleted and years. Shown on the Albums tab and Home. */
export function AlbumsOverview({
  header,
  onScroll,
}: {
  header?: ReactNode;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { library, data, vaultCount, trashCount } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const unlocked = useVaultUnlocked();
  const [naming, setNaming] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [options, setOptions] = useState<Album | null>(null);
  const albums = buildAlbums(library.items, data);
  const hiddenIds = new Set(data.folders.filter((f) => f.hidden).map((f) => `folder:${f.id}`));
  const folders = albums.folders.filter((album) => showHidden || !hiddenIds.has(album.scope));
  const optionsHidden = !!options && hiddenIds.has(options.scope);

  const open = (album: Album) => router.push({ pathname: '/album', params: { scope: album.scope } });

  return (
    <ScrollView contentContainerStyle={styles.content} onScroll={onScroll} scrollEventThrottle={32}>
      {header}
      <View style={styles.body}>
        <Pressable
          onPress={() => router.push('/vault')}
          accessibilityLabel="Vault"
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.vault}>
            <View style={[styles.vaultIcon, { backgroundColor: accent }]}>
              <Icon
                ios={unlocked ? 'lock.open.fill' : 'lock.fill'}
                android={unlocked ? 'lock_open' : 'lock'}
                color="#fff"
              />
            </View>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Vault</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {data.vault
                  ? `${vaultCount} saved · ${data.collections.length} albums · passcode protected`
                  : 'Save photos privately behind a passcode'}
              </ThemedText>
            </View>
            <Icon ios="chevron.right" android="chevron_right" size={16} color={theme.textSecondary} />
          </ThemedView>
        </Pressable>

        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold" style={[styles.sectionTitle, styles.flex]}>
            Folders
          </ThemedText>
          {hiddenIds.size > 0 && (
            <Pressable onPress={() => setShowHidden((s) => !s)} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" style={[styles.sectionTitleAction, { color: accent }]}>
                {showHidden ? 'Hide hidden' : `Show hidden (${hiddenIds.size})`}
              </ThemedText>
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
          <Pressable
            onPress={() => setNaming(true)}
            accessibilityLabel="New folder"
            style={({ pressed }) => pressed && styles.pressed}>
            <View style={[styles.newFolder, { borderColor: theme.backgroundSelected }]}>
              <Icon ios="folder.badge.plus" android="create_new_folder" size={30} color={accent} />
              <ThemedText type="smallBold" style={{ color: accent }}>
                New folder
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
          Media types
        </ThemedText>
        <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
          {[
            ...albums.smart,
            {
              scope: 'trash' as const,
              title: 'Recently deleted',
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
          By year
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
                if (!optionsHidden) showToast(`“${options.title}” hidden from Albums`);
                setOptions(null);
              }}
              style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
              <Icon
                ios={optionsHidden ? 'eye' : 'eye.slash'}
                android={optionsHidden ? 'visibility' : 'visibility_off'}
                color={accent}
              />
              <ThemedText style={styles.flex}>{optionsHidden ? 'Unhide album' : 'Hide album'}</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                const album = options;
                setOptions(null);
                confirmAction(`Delete “${album.title}”?`, 'Only the folder is removed; its photos stay in your gallery.', 'Delete', () =>
                  deleteFolder(album.scope.replace('folder:', ''))
                );
              }}
              style={({ pressed }) => [
                styles.listRow,
                { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <Icon ios="trash" android="delete" color="#E5484D" />
              <ThemedText style={[styles.flex, { color: '#E5484D' }]}>Delete album</ThemedText>
            </Pressable>
          </View>
        )}
      </Sheet>
      <TextPrompt
        visible={naming}
        title="New folder"
        placeholder="e.g. Trip to Rome"
        submitLabel="Create"
        onClose={() => setNaming(false)}
        onSubmit={(name) => {
          const id = createFolder(name);
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
  vault: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  vaultIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
