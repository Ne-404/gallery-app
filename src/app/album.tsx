import { Redirect, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { MediaGrid } from '@/components/media-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGallery } from '@/hooks/use-gallery';
import { deleteFromDevice } from '@/lib/media';
import { scopeTitle, type Scope } from '@/lib/scopes';
import { confirmAction } from '@/lib/ui';
import { forgetItems, restoreItems } from '@/lib/user-data';
import { isVaultScope, useVaultUnlocked } from '@/lib/vault';

export default function AlbumScreen() {
  const { scope = 'all' } = useLocalSearchParams<{ scope?: Scope }>();
  const { data, scoped } = useGallery();
  const unlocked = useVaultUnlocked();
  const items = scoped(scope);

  if (isVaultScope(scope) && !unlocked) return <Redirect href="/vault" />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title={scopeTitle(scope, data)}
          leading="back"
          actions={
            scope === 'trash' && items.length > 0 ? (
              <>
                <IconButton
                  label="Restore all"
                  onPress={() => {
                    restoreItems(items.map((i) => i.id));
                  }}>
                  <Icon ios="arrow.uturn.backward" android="restore" />
                </IconButton>
                <IconButton
                  label="Empty"
                  onPress={() =>
                    confirmAction(
                      'Delete everything forever?',
                      `${items.length} ${items.length === 1 ? 'item' : 'items'} will be deleted. This can’t be undone.`,
                      'Delete all',
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
            ) : null
          }
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </ThemedText>
        <MediaGrid
          items={items}
          scope={scope}
          likes={data.likes}
          edits={data.edits}
          empty={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {scope === 'trash'
                ? 'Nothing deleted. Deleted photos wait here so you can restore them.'
                : 'Nothing here yet.'}
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
