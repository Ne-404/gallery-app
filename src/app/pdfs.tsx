import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/dates';
import { canScanDevice } from '@/lib/device-files';
import { choosePdfFolder, deletePdf, importPdfs, openDevicePdf, scanDevicePdfs, useDetectedPdfs } from '@/lib/pdf-store';
import { confirmAction } from '@/lib/ui';
import { useUserData, type PdfDoc } from '@/lib/user-data';

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Offline PDF library: import documents and read them without leaving the app. */
export default function PdfLibraryScreen() {
  const { pdfs, settings } = useUserData();
  const onDevice = useDetectedPdfs();
  const added = new Set(pdfs.map((p) => p.uri));
  const notAdded = onDevice.filter((f) => !added.has(f.uri));

  // PDFs in the chosen folder show up automatically.
  useEffect(() => {
    scanDevicePdfs();
  }, [settings.pdfFolder]);
  const accent = useAccent();
  const theme = useTheme();

  const importDocs = async () => {
    await importPdfs();
  };
  const remove = (doc: PdfDoc) =>
    confirmAction(`Delete “${doc.name}”?`, 'It’s removed from this app.', 'Delete', () => deletePdf(doc));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title="PDF reader"
          leading="back"
          actions={
            <>
              {canScanDevice && (
                <IconButton label="Choose a PDF folder" onPress={choosePdfFolder}>
                  <Icon ios="folder.badge.gearshape" android="folder_open" />
                </IconButton>
              )}
              <IconButton label="Import PDF" onPress={importDocs}>
                <Icon ios="plus" android="add" />
              </IconButton>
            </>
          }
        />
        <FlatList
          data={pdfs}
          keyExtractor={(doc) => doc.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            notAdded.length > 0 ? (
              <View style={styles.device}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  ON THIS DEVICE · {notAdded.length}
                </ThemedText>
                {notAdded.map((file) => (
                  <Pressable
                    key={file.uri}
                    accessibilityLabel={`Open ${file.name}`}
                    onPress={() => router.push({ pathname: '/pdf', params: { id: openDevicePdf(file) } })}
                    style={({ pressed }) => [styles.deviceRow, pressed && styles.pressed]}>
                    <Icon ios="doc.text" android="description" size={20} color={theme.textSecondary} />
                    <ThemedText numberOfLines={1} style={styles.flex}>
                      {file.name}
                    </ThemedText>
                    <Icon ios="chevron.right" android="chevron_right" size={16} color={theme.textSecondary} />
                  </Pressable>
                ))}
                {pdfs.length > 0 && (
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.libraryTitle}>
                    YOUR LIBRARY
                  </ThemedText>
                )}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${accent}22` }]}>
                <Icon ios="book" android="menu_book" size={40} color={accent} />
              </View>
              <ThemedText type="smallBold" style={styles.emptyTitle}>
                Your private bookshelf
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Import PDFs, or pick a folder (like Downloads) and its PDFs will show up here automatically.
              </ThemedText>
              <Pressable
                onPress={importDocs}
                accessibilityLabel="Import a PDF"
                style={({ pressed }) => [styles.button, { backgroundColor: accent }, pressed && styles.pressed]}>
                <Icon ios="square.and.arrow.down" android="file_open" size={18} color="#fff" />
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Import a PDF
                </ThemedText>
              </Pressable>
            </View>
          }
          renderItem={({ item: doc }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/pdf', params: { id: doc.id } })}
              onLongPress={() => remove(doc)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.row}>
                <View style={[styles.cover, { backgroundColor: accent }]}>
                  <Icon ios="book.closed.fill" android="menu_book" size={22} color="#fff" />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {doc.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatSize(doc.size)} · added {timeAgo(doc.addedAt)}
                  </ThemedText>
                </View>
                <IconButton label={`Delete ${doc.name}`} onPress={() => remove(doc)}>
                  <Icon ios="trash" android="delete" size={20} color={theme.textSecondary} />
                </IconButton>
              </ThemedView>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    borderRadius: Spacing.three,
  },
  cover: {
    width: 40,
    height: 52,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 24,
  },
  buttonText: {
    color: '#fff',
  },
  device: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  libraryTitle: {
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
