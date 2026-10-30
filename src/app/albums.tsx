import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumsOverview } from '@/components/albums-overview';
import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedView } from '@/components/themed-view';
import { useT } from '@/lib/i18n';

export default function AlbumsScreen() {
  const t = useT();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title={t('Albums')}
          leading="back"
          actions={
            <IconButton label={t('Search')} onPress={() => router.push('/search')}>
              <Icon ios="magnifyingglass" android="search" />
            </IconButton>
          }
        />
        <AlbumsOverview />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
