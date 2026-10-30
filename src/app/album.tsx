import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { MediaGrid } from '@/components/media-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGallery } from '@/hooks/use-gallery';
import { useT } from '@/lib/i18n';
import { deleteFromDevice } from '@/lib/media';
import { scopeTitle, type Scope } from '@/lib/scopes';
import { confirmAction } from '@/lib/ui';
import { forgetItems, restoreItems, TRASH_DAYS } from '@/lib/user-data';
import { isVaultScope, useVaultUnlocked } from '@/lib/vault';

export default function AlbumScreen() {
  const { scope = 'all' } = useLocalSearchParams<{ scope?: Scope }>();
  const { data, scoped } = useGallery();
  const unlocked = useVaultUnlocked();
  const t = useT();
  const [oldestFirst, setOldestFirst] = useState(false);
  const scopedItems = scoped(scope);
  const items = oldestFirst ? [...scopedItems].reverse() : scopedItems;

  if (isVaultScope(scope) && !unlocked) return <Redirect href="/vault" />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title={scopeTitle(scope, data, t)}
          leading="back"
          actions={
            <>
              <IconButton
                label={oldestFirst ? t('Show newest first') : t('Show oldest first')}
                onPress={() => setOldestFirst((o) => !o)}>
                <Icon ios="arrow.up.arrow.down" android="swap_vert" />
              </IconButton>
              {scope === 'trash' && items.length > 0 && (
              <>
                <IconButton
                  label={t('Restore all')}
                  onPress={() => {
                    restoreItems(items.map((i) => i.id));
                  }}>
                  <Icon ios="arrow.uturn.backward" android="restore" />
                </IconButton>
                <IconButton
                  label={t('Empty')}
                  onPress={() =>
                    confirmAction(
                      t('Delete everything forever?'),
                      t.n(items.length, '{n} item will be deleted. This can’t be undone.', '{n} items will be deleted. This can’t be undone.'),
                      t('Delete all'),
                      async () => {
                        const ids = items.map((i) => i.id);
                        await deleteFromDevice(ids);
                        forgetItems(ids);
                      }
                    )
                  }>
                  <Icon ios="trash" android="delete_forever" color="#E5484D" />
                </IconButton>
              </>
              )}
            </>
          }
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
          {t.n(items.length, '{n} item', '{n} items')} · {oldestFirst ? t('oldest first') : t('newest first')}
          {scope === 'trash' ? ` · ${t('removed after {n} days', { n: TRASH_DAYS })}` : ''}
        </ThemedText>
        <MediaGrid
          key={oldestFirst ? 'oldest' : 'newest'}
          items={items}
          scope={scope}
          likes={data.likes}
          edits={data.edits}
          empty={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {scope === 'trash'
                ? t('Nothing deleted. Deleted photos wait here so you can restore them.')
                : t('Nothing here yet.')}
            </ThemedText>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  count: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
});
