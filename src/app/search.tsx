import { router } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { MediaGrid } from '@/components/media-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { buildAlbums } from '@/lib/scopes';
import { searchMedia } from '@/lib/search';

const SUGGESTIONS = ['Videos', 'Live', 'Burst', 'Liked', 'Edited', 'Notes', 'Weekend', 'Summer'];

export default function SearchScreen() {
  const { library, data } = useGallery();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const results = searchMedia(query, library.items, data);
  const albums = buildAlbums(library.items, data);
  const years = albums.years.map((a) => a.title);

  // "Weekend" and "Summer" are friendly aliases for weekday and month words.
  const expand = (s: string) =>
    s === 'Weekend' ? 'saturday' : s === 'Summer' ? 'july' : s === 'Videos' ? 'video' : s;

  // Each chip shows what tapping it finds, so dead ends are hidden. Only counted while the
  // chips are on screen, not on every keystroke.
  const counts: Record<string, number> =
    query.trim() === ''
      ? Object.fromEntries(
          [...SUGGESTIONS, ...years].map((s) => [s, searchMedia(expand(s).toLowerCase(), library.items, data).length])
        )
      : {};

  const choose = (s: string) => {
    setQuery(expand(s).toLowerCase());
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.bar}>
          <IconButton label="Back" onPress={() => router.back()}>
            <Icon ios="chevron.left" android="arrow_back" />
          </IconButton>
          <ThemedView type="backgroundElement" style={styles.field}>
            <Icon ios="magnifyingglass" android="search" size={20} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes, videos, filters, months…"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              returnKeyType="search"
              accessibilityLabel="Search"
              style={[styles.input, { color: theme.text }, noFocusRing]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <Icon ios="xmark.circle.fill" android="close" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </ThemedView>
        </View>

        {query.trim() === '' ? (
          <ScrollView contentContainerStyle={styles.suggestions}>
            <Group title="Try" items={SUGGESTIONS.filter((s) => counts[s] > 0)} counts={counts} onPick={choose} />
            <Group title="Years" items={years} counts={counts} onPick={choose} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.privacy}>
              🔒 Search runs entirely on this device.
            </ThemedText>
          </ScrollView>
        ) : (
          <MediaGrid
            items={results}
            scope="all"
            likes={data.likes}
            edits={data.edits}
            header={
              <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </ThemedText>
            }
            empty={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Nothing matches “{query}”.
              </ThemedText>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function Group({
  title,
  items,
  counts,
  onPick,
}: {
  title: string;
  items: string[];
  counts: Record<string, number>;
  onPick: (value: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.chips}>
        {items.map((item) => (
          <Pressable key={item} onPress={() => onPick(item)} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.chip}>
              <ThemedText type="small">{item}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {counts[item]}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Our fields have their own container styling, so drop the browser's focus outline.
const noFocusRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  suggestions: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  privacy: {
    textAlign: 'center',
  },
  count: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
  pressed: {
    opacity: 0.6,
  },
});
