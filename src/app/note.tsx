import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/dates';
import { continueList, NOTE_COLORS, parseLines, prefixLine, toggleLine } from '@/lib/notes';
import { confirmAction } from '@/lib/ui';
import { useVaultUnlocked } from '@/lib/vault';
import {
  createJournalNote,
  deleteJournalNote,
  setNote,
  updateJournalNote,
  userData,
  type NoteColor,
} from '@/lib/user-data';

/**
 * Note editor, for freestanding notes (`?id=`, or none for a new one) and photo notes
 * (`?photo=`). Everything saves as you type.
 */
export default function NoteScreen() {
  const params = useLocalSearchParams<{ id?: string; photo?: string }>();
  const { data, itemsById, library, isVaulted } = useGallery();
  const vaultUnlocked = useVaultUnlocked();
  const accent = useAccent();
  const theme = useTheme();
  const [noteId, setNoteId] = useState(params.id ?? null);
  const note = noteId ? data.journal.find((n) => n.id === noteId) : undefined;
  const photoId = params.photo;
  const photoNote = photoId ? data.notes[photoId] : undefined;

  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(photoId ? (photoNote?.text ?? '') : (note?.body ?? ''));
  const [editing, setEditing] = useState(!body);
  const [cursor, setCursor] = useState(body.length);
  const [palette, setPalette] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const save = (patch: { title?: string; body?: string; itemIds?: string[] }) => {
    if (photoId) {
      if (patch.body !== undefined) setNote(photoId, patch.body);
      return;
    }
    if (noteId) updateJournalNote(noteId, patch);
    else setNoteId(createJournalNote(patch));
  };

  // Leaving an untouched new note doesn't leave an empty card behind.
  useEffect(
    () => () => {
      const latest = userData.get().journal.find((n) => n.id === noteId);
      if (latest && !latest.title.trim() && !latest.body.trim() && latest.itemIds.length === 0) {
        deleteJournalNote(latest.id);
      }
    },
    [noteId]
  );

  const changeBody = (text: string) => {
    const next = continueList(body, text);
    setBody(next);
    save({ body: next });
  };
  const insert = (prefix: string) => {
    const next = prefixLine(body, cursor, prefix);
    setBody(next);
    save({ body: next });
    // Toolbar taps take focus (on web); hand it back with the cursor at the line's end.
    const lineEnd = next.indexOf('\n', cursor);
    const at = lineEnd === -1 ? next.length : lineEnd;
    setCursor(at);
    requestAnimationFrame(() => {
      const field = input.current as unknown as { focus?: () => void; setSelection?: (a: number, b: number) => void } | null;
      field?.focus?.();
      field?.setSelection?.(at, at);
    });
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/notes'));
  const tint = note ? NOTE_COLORS[note.color] : null;
  const attached = (note?.itemIds ?? []).flatMap((id) => (isVaulted(id) ? [] : (itemsById.get(id) ?? [])));
  const words = `${title} ${body}`.split(/\s+/).filter((w) => w && !/^[☐☑•#]$/.test(w)).length;
  const photo = photoId ? itemsById.get(photoId) : undefined;

  // A note on a vault photo is part of the vault.
  if (photoId && isVaulted(photoId) && !vaultUnlocked) return <Redirect href="/vault" />;

  return (
    <ThemedView style={[styles.container, tint && { backgroundColor: `${tint}${theme.dark ? '22' : '1A'}` }]}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.bar}>
          <IconButton label="Back" onPress={close}>
            <Icon ios="chevron.left" android="arrow_back" />
          </IconButton>
          <View style={styles.flex} />
          {!photoId && (
            <>
              <IconButton
                label={note?.pinned ? 'Unpin' : 'Pin'}
                onPress={() => {
                  if (noteId) updateJournalNote(noteId, { pinned: !note?.pinned }, false);
                  else setNoteId(createJournalNote({ title, body, pinned: true }));
                }}>
                <Icon ios={note?.pinned ? 'pin.fill' : 'pin'} android="push_pin" color={note?.pinned ? accent : undefined} />
              </IconButton>
              <IconButton label="Color" onPress={() => setPalette((p) => !p)}>
                <Icon ios="paintpalette" android="palette" />
              </IconButton>
              <IconButton label="Attach photo" onPress={() => setAttaching(true)}>
                <Icon ios="photo.badge.plus" android="add_photo_alternate" />
              </IconButton>
            </>
          )}
          <IconButton
            label="Share note"
            onPress={() => Share.share({ message: [title, body].filter(Boolean).join('\n\n') }).catch(() => {})}>
            <Icon ios="square.and.arrow.up" android="share" />
          </IconButton>
          <IconButton
            label="Delete note"
            onPress={() =>
              confirmAction('Delete this note?', 'This can’t be undone.', 'Delete', () => {
                if (photoId) setNote(photoId, '');
                else if (noteId) deleteJournalNote(noteId);
                close();
              })
            }>
            <Icon ios="trash" android="delete" />
          </IconButton>
        </View>

        {palette && (
          <View style={styles.palette}>
            {(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => (
              <Pressable
                key={color}
                accessibilityLabel={`${color} note`}
                onPress={() => {
                  if (noteId) updateJournalNote(noteId, { color }, false);
                  else setNoteId(createJournalNote({ title, body, color }));
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: NOTE_COLORS[color] ?? theme.backgroundElement, borderColor: theme.textSecondary },
                  (note?.color ?? 'none') === color && { borderColor: accent, borderWidth: 3 },
                ]}
              />
            ))}
          </View>
        )}

        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          {photo && (
            <Pressable onPress={() => router.push({ pathname: '/viewer', params: { id: photo.id } })}>
              <Image source={{ uri: photo.thumbUri }} style={styles.photo} contentFit="cover" />
            </Pressable>
          )}
          {photoId ? (
            <ThemedText style={styles.titleInput}>{data.titles[photoId] ?? 'Photo note'}</ThemedText>
          ) : (
            <TextInput
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                save({ title: t });
              }}
              placeholder="Title"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Note title"
              style={[styles.titleInput, { color: theme.text }, noFocusRing]}
            />
          )}

          {editing ? (
            <TextInput
              ref={input}
              value={body}
              onChangeText={changeBody}
              onSelectionChange={(e) => setCursor(e.nativeEvent.selection.start)}
              placeholder="Start writing…"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Note text"
              multiline
              autoFocus={!!body || !!photoId || !!note}
              scrollEnabled={false}
              style={[styles.body, { color: theme.text }, noFocusRing]}
            />
          ) : (
            <Pressable onPress={() => setEditing(true)} accessibilityLabel="Edit note" style={styles.reader}>
              {parseLines(body).map((line, i) =>
                line.type === 'check' ? (
                  <View key={i} style={styles.checkRow}>
                    <Pressable
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: line.done }}
                      accessibilityLabel={line.text || 'Checklist item'}
                      onPress={() => {
                        const next = toggleLine(body, i);
                        setBody(next);
                        save({ body: next });
                      }}>
                      <Icon
                        ios={line.done ? 'checkmark.circle.fill' : 'circle'}
                        android={line.done ? 'check_circle' : 'radio_button_unchecked'}
                        size={22}
                        color={line.done ? accent : theme.textSecondary}
                      />
                    </Pressable>
                    <ThemedText
                      style={[styles.lineText, line.done && { color: theme.textSecondary, textDecorationLine: 'line-through' }]}>
                      {line.text}
                    </ThemedText>
                  </View>
                ) : line.type === 'heading' ? (
                  <ThemedText key={i} style={styles.heading}>
                    {line.text}
                  </ThemedText>
                ) : (
                  <ThemedText key={i} style={styles.lineText}>
                    {line.type === 'bullet' ? `•  ${line.text}` : line.text || ' '}
                  </ThemedText>
                )
              )}
            </Pressable>
          )}

          {attached.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachments}>
              {attached.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push({ pathname: '/viewer', params: { id: item.id } })}
                  onLongPress={() =>
                    noteId && updateJournalNote(noteId, { itemIds: (note?.itemIds ?? []).filter((x) => x !== item.id) })
                  }>
                  <Image source={{ uri: item.thumbUri }} style={styles.attachment} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </ScrollView>

        <View style={[styles.toolbar, { borderColor: theme.backgroundSelected }]}>
          {editing ? (
            <>
              <IconButton label="Checklist" onPress={() => insert('☐ ')}>
                <Icon ios="checklist" android="checklist" />
              </IconButton>
              <IconButton label="Bullet" onPress={() => insert('• ')}>
                <Icon ios="list.bullet" android="format_list_bulleted" />
              </IconButton>
              <IconButton label="Heading" onPress={() => insert('# ')}>
                <Icon ios="textformat.size" android="title" />
              </IconButton>
            </>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
            {note || photoNote ? `Edited ${timeAgo(note?.updatedAt ?? photoNote!.updatedAt)}` : 'New note'} · {words}{' '}
            {words === 1 ? 'word' : 'words'}
          </ThemedText>
          {editing && (
            <Pressable onPress={() => setEditing(false)} accessibilityLabel="Done editing" style={styles.done}>
              <ThemedText type="smallBold" style={{ color: accent }}>
                Done
              </ThemedText>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <Sheet visible={attaching} title="Attach a photo" onClose={() => setAttaching(false)}>
        <ScrollView contentContainerStyle={styles.pickGrid}>
          {library.items
            .filter((i) => i.type === 'photo')
            .slice(0, 60)
            .map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  const itemIds = [...(note?.itemIds ?? []), item.id];
                  if (noteId) updateJournalNote(noteId, { itemIds });
                  else setNoteId(createJournalNote({ title, body, itemIds }));
                  setAttaching(false);
                }}>
                <Image source={{ uri: item.thumbUri }} style={styles.pick} contentFit="cover" />
              </Pressable>
            ))}
        </ScrollView>
      </Sheet>
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: Spacing.one,
  },
  palette: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  page: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  photo: {
    height: 160,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  titleInput: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 800,
    paddingVertical: Spacing.one,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    minHeight: 240,
    textAlignVertical: 'top',
  },
  reader: {
    minHeight: 240,
    gap: Spacing.half,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  lineText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
  },
  heading: {
    fontSize: 21,
    lineHeight: 30,
    fontWeight: 800,
    marginTop: Spacing.two,
  },
  attachments: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  attachment: {
    width: 96,
    height: 96,
    borderRadius: Spacing.two,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    minHeight: 52,
  },
  meta: {
    flex: 1,
    textAlign: 'center',
  },
  done: {
    padding: Spacing.two,
  },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  pick: {
    width: 84,
    height: 84,
    borderRadius: 6,
  },
});
