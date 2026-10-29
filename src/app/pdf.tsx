import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { PdfView } from '@/components/pdf-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { pdfUrl } from '@/lib/pdf-store';
import { shareFile } from '@/lib/share';
import { useUserData } from '@/lib/user-data';

/** Reads one imported PDF. */
export default function PdfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doc = useUserData().pdfs.find((p) => p.id === id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <AppBar
          title={doc?.name ?? 'PDF'}
          leading="back"
          actions={
            doc ? (
              <IconButton
                label="Open or share"
                onPress={async () => {
                  const url = await pdfUrl(doc);
                  if (url) shareFile(url);
                }}>
                <Icon ios="square.and.arrow.up" android="share" />
              </IconButton>
            ) : null
          }
        />
        {doc ? (
          <PdfView doc={doc} />
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            This PDF isn’t available anymore.
          </ThemedText>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  message: {
    textAlign: 'center',
    padding: Spacing.five,
  },
});
