import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { MovePicker } from '@/components/move-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LikeColor, Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TKey } from '@/lib/i18n';
import { deleteFromDevice } from '@/lib/media';
import type { Scope } from '@/lib/scopes';
import { shareItems } from '@/lib/share';
import { showToast } from '@/lib/toast';
import { confirmAction } from '@/lib/ui';
import { isVaultScope } from '@/lib/vault';
import { copyItem, forgetItems, likeItems, restoreItems, trashItems } from '@/lib/user-data';

type SelectionBarProps = {
  selected: string[];
  scope: Scope;
  /** Every item in the grid, for "Select all". */
  allIds: string[];
  /** New selection; null leaves selection mode. */
  onChange: (selected: string[] | null) => void;
};

/** Top bar shown while selecting: count, select all / deselect, and bulk actions. */
export function SelectionBar({ selected, scope, allIds, onChange }: SelectionBarProps) {
  const { itemsById, data } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  const [moving, setMoving] = useState<'folder' | 'vault' | null>(null);
  const count = selected.length;
  const allSelected = count === allIds.length && count > 0;
  const done = () => onChange(null);
  const items = selected.flatMap((id) => itemsById.get(id) ?? []);

  const actions: {
    label: TKey;
    icon: { ios: SFSymbol; android: AndroidSymbol };
    color?: string;
    onPress: () => void;
  }[] =
    scope === 'trash'
      ? [
          {
            label: 'Restore',
            icon: { ios: 'arrow.uturn.backward', android: 'restore' },
            onPress: () => {
              restoreItems(selected);
              showToast(t('Restored {n}', { n: count }));
              done();
            },
          },
          {
            label: 'Delete forever',
            icon: { ios: 'trash.slash', android: 'delete_forever' },
            color: '#E5484D',
            onPress: () =>
              confirmAction(t('Delete {n} forever?', { n: count }), t('This can’t be undone.'), t('Delete'), async () => {
                done();
                await deleteFromDevice(selected);
                forgetItems(selected);
              }),
          },
        ]
      : [
          {
            label: 'Share',
            icon: { ios: 'square.and.arrow.up', android: 'share' },
            onPress: async () => {
              await shareItems(items, data.edits);
            },
          },
          {
            label: 'Favorite',
            icon: { ios: 'heart', android: 'favorite_border' },
            color: LikeColor,
            onPress: () => {
              likeItems(selected);
              showToast(t('Added {n} to favorites', { n: count }));
              done();
            },
          },
          {
            label: 'Folder',
            icon: { ios: 'folder', android: 'drive_file_move' },
            onPress: () => setMoving('folder'),
          },
          { label: 'Vault', icon: { ios: 'lock', android: 'lock' }, onPress: () => setMoving('vault') },
          {
            label: 'Copy',
            icon: { ios: 'plus.square.on.square', android: 'content_copy' },
            onPress: () => {
              selected.forEach(copyItem);
              showToast(count === 1 ? t('Copy made') : t('{n} copies made', { n: count }));
              done();
            },
          },
          {
            label: 'Delete',
            icon: { ios: 'trash', android: 'delete' },
            color: '#E5484D',
            onPress: () => {
              if (isVaultScope(scope)) {
                confirmAction(t('Delete {n} from vault?', { n: count }), t('Vault photos are deleted permanently.'), t('Delete'), async () => {
                  done();
                  await deleteFromDevice(selected);
                  forgetItems(selected);
                });
                return;
              }
              trashItems(selected);
              const trashed = selected;
              showToast(t('{n} moved to Recently deleted', { n: count }), { label: t('Undo'), onPress: () => restoreItems(trashed) });
              done();
            },
          },
        ];

  return (
    <ThemedView style={[styles.bar, { borderColor: theme.backgroundSelected }]}>
      <View style={styles.top}>
        <Pressable onPress={done} hitSlop={8} accessibilityLabel={t('Cancel selection')} style={styles.iconButton}>
          <Icon ios="xmark" android="close" />
        </Pressable>
        <ThemedText type="smallBold" style={styles.count}>
          {count === 0 ? t('Select items') : t('{n} selected', { n: count })}
        </ThemedText>
        <Pressable
          onPress={() => {
            onChange(allSelected ? [] : allIds);
          }}
          accessibilityLabel={allSelected ? t('Deselect all') : t('Select all')}
          hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: accent }}>
            {allSelected ? t('Deselect all') : t('Select all')}
          </ThemedText>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            disabled={count === 0}
            accessibilityLabel={t(action.label)}
            onPress={action.onPress}
            style={({ pressed }) => [styles.action, (pressed || count === 0) && styles.dim]}>
            <Icon {...action.icon} size={22} color={action.color} />
            <ThemedText type="small" style={[styles.actionLabel, action.color && { color: action.color }]}>
              {t(action.label)}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      <MovePicker itemIds={moving ? selected : null} target={moving ?? 'folder'} onClose={() => setMoving(null)} onDone={done} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.12)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingRight: Spacing.three,
    height: 48,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    flex: 1,
    fontSize: 16,
  },
  actions: {
    paddingHorizontal: Spacing.one,
  },
  action: {
    alignItems: 'center',
    gap: Spacing.half,
    minWidth: 62,
    paddingVertical: Spacing.one,
  },
  actionLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  dim: {
    opacity: 0.4,
  },
});
