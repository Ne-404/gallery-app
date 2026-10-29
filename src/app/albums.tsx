import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumsOverview } from '@/components/albums-overview';
import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedView } from '@/components/themed-view';

export default function AlbumsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title="Albums"
          leading="back"
          actions={
            <>
              <IconButton label="Search" onPress={() => router.push('/search')}>
                <Icon ios="magnifyingglass" android="search" />
              </IconButton>
              <IconButton label="Open vault" onPress={() => router.push('/vault')}>
                <Icon ios="lock" android="lock" />
              </IconButton>
            </>
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
