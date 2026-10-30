import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { TextPrompt } from '@/components/text-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useT } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import {
  addToCollection,
  createCollection,
  createFolder,
  moveToFolder,
  useUserData,
} from '@/lib/user-data';

type MovePickerProps = {
  /** The items being moved; null hides the picker. */
  itemIds: string[] | null;
  /** A regular folder, or a private vault album. */
  target: 'folder' | 'vault';
  onClose: () => void;
  onDone?: () => void;
};

/** "Move to folder" / "Move to vault" for one or many items. */
export function MovePicker({ itemIds, target, onClose, onDone }: MovePickerProps) {
  const { folders, collections } = useUserData();
  const accent = useAccent();
  const t = useT();
  const [naming, setNaming] = useState(false);
  const options =
    target === 'folder'
      ? folders.map((f) => ({ id: f.id, name: f.name, count: f.itemIds.length }))
      : collections.map((c) => ({ id: c.id, name: c.name, count: c.items.length }));
  const count = itemIds?.length ?? 0;

  const move = (id: string) => {
    if (!itemIds) return;
    if (target === 'folder') moveToFolder(id, itemIds);
    else addToCollection(id, itemIds);
    const folder = target === 'folder' ? folders.find((o) => o.id === id)?.name : undefined;
    showToast(
      folder
        ? t('Moved {n} to {name}', { n: itemIds.length, name: folder })
        : target === 'folder'
          ? t('Moved {n} to a folder', { n: itemIds.length })
          : t('Moved {n} to the vault', { n: itemIds.length })
    );
    onClose();
    onDone?.();
  };

  return (
    <>
      <Sheet
        visible={itemIds !== null && !naming}
        title={
          target === 'folder'
            ? t.n(count, 'Move {n} item to a folder', 'Move {n} items to a folder')
            : t.n(count, 'Move {n} item to the vault', 'Move {n} items to the vault')
        }
        onClose={onClose}>
        <ScrollView contentContainerStyle={styles.list}>
          {target === 'vault' && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              {t('🔒 Vault photos are hidden from your gallery and open only with your passcode.')}
            </ThemedText>
          )}
          <Pressable onPress={() => setNaming(true)} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.row}>
              <Icon ios="plus" android="add" color={accent} />
              <ThemedText style={{ color: accent }}>
                {target === 'folder' ? t('New folder') : t('New vault album')}
              </ThemedText>
            </ThemedView>
          </Pressable>
          {options.map((option) => (
            <Pressable
              key={option.id}
              accessibilityLabel={t('Move to {name}', { name: option.name })}
              onPress={() => move(option.id)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.row}>
                <Icon
                  ios={target === 'folder' ? 'folder' : 'lock'}
                  android={target === 'folder' ? 'folder' : 'lock'}
                />
                <View style={styles.flex}>
                  <ThemedText>{option.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t.n(option.count, '{n} item', '{n} items')}
                  </ThemedText>
                </View>
              </ThemedView>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      <TextPrompt
        visible={naming}
        title={target === 'folder' ? t('New folder') : t('New vault album')}
        placeholder={t('Name')}
        submitLabel={t('Create & move')}
        onClose={() => setNaming(false)}
        onSubmit={(name) =>
          move(
            target === 'folder'
              ? createFolder(name.trim() || t('New folder'))
              : createCollection(name.trim() || t('Untitled'))
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  note: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
