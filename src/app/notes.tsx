import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/dates';
import { NOTE_COLORS, noteEntries, parseLines, type NoteEntry } from '@/lib/notes';

/** Notes app: freestanding notes and photo notes together, searchable, pinned first. */
export default function NotesScreen() {
  const { data, itemsById, isVaulted } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const entries = noteEntries(data, isVaulted).filter((e) => {
    const text = `${e.title}\n${e.body}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });

  const open = (entry: NoteEntry) =>
    router.push({
      pathname: '/note',
      params: entry.kind === 'journal' ? { id: entry.id } : { photo: entry.itemId },
    });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar title="Notes" leading="back" />
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          numColumns={2}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <ThemedView type="backgroundElement" style={styles.search}>
              <Icon ios="magnifyingglass" android="search" size={18} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${entries.length} ${entries.length === 1 ? "note" : "notes"}`}
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Search notes"
                style={[styles.searchInput, { color: theme.text }, noFocusRing]}
              />
            </ThemedView>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon ios="note.text" android="sticky_note_2" size={44} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {query ? 'No notes match.' : 'No notes yet. Tap the pencil to write one, or add a note to any photo.'}
              </ThemedText>
            </View>
          }
          renderItem={({ item: entry }) => {
            const tint = entry.kind === 'journal' ? NOTE_COLORS[entry.note.color] : null;
            const photoId = entry.kind === 'photo' ? entry.itemId : entry.note.itemIds[0];
            const photo = photoId && !isVaulted(photoId) ? itemsById.get(photoId) : undefined;
            const lines = parseLines(entry.body).filter((l) => l.text.trim()).slice(0, 5);
            return (
              <Pressable onPress={() => open(entry)} style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.card, tint && { backgroundColor: `${tint}${theme.dark ? '33' : '2E'}`, borderColor: `${tint}88` }]}>
                  {photo && <Image source={{ uri: photo.thumbUri }} style={styles.thumb} contentFit="cover" />}
                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <ThemedText type="smallBold" numberOfLines={2} style={styles.flex}>
                        {entry.title}
                      </ThemedText>
                      {entry.pinned && <Icon ios="pin.fill" android="push_pin" size={14} color={accent} />}
                    </View>
                    {lines.map((line, i) => (
                      <ThemedText
                        key={i}
                        type="small"
                        numberOfLines={1}
                        themeColor="textSecondary"
                        style={line.type === 'check' && line.done && styles.done}>
                        {line.type === 'check' ? `${line.done ? '☑' : '☐'} ` : line.type === 'bullet' ? '• ' : ''}
                        {line.text}
                      </ThemedText>
                    ))}
                    <ThemedText type="small" themeColor="textSecondary" style={styles.date}>
                      {entry.kind === 'photo' ? '📷 ' : ''}
                      {timeAgo(entry.updatedAt)}
                    </ThemedText>
                  </View>
                </ThemedView>
              </Pressable>
            );
          }}
        />
        <Pressable
          onPress={() => {
            router.push('/note');
          }}
          accessibilityLabel="New note"
          style={({ pressed }) => [styles.fab, { backgroundColor: accent }, pressed && styles.pressed]}>
          <Icon ios="square.and.pencil" android="edit_square" size={26} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const noFocusRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  list: {
    padding: Spacing.three,
    paddingBottom: 120,
    gap: Spacing.two,
    flexGrow: 1,
  },
  columns: {
    gap: Spacing.two,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    marginBottom: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two + 2,
  },
  cell: {
    flex: 1,
    maxWidth: '50%',
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumb: {
    height: 90,
  },
  cardBody: {
    padding: Spacing.three,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
    marginBottom: Spacing.half,
  },
  done: {
    textDecorationLine: 'line-through',
  },
  date: {
    fontSize: 11,
    marginTop: Spacing.one,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  center: {
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.five,
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 6px 18px rgba(0,0,0,0.3)',
  },
  pressed: {
    opacity: 0.6,
  },
});
