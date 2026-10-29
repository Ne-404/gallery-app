import { router } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CollectionPicker } from '@/components/collection-picker';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { TextPrompt } from '@/components/text-prompt';
import { ThemedText } from '@/components/themed-text';
import { LikeColor, Spacing } from '@/constants/theme';
import { useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatDuration } from '@/lib/dates';
import { isEdited } from '@/lib/edits';
import { deleteFromDevice } from '@/lib/media';
import { shareItem } from '@/lib/share';
import { showToast } from '@/lib/toast';
import { confirmAction } from '@/lib/ui';
import {
  copyItem,
  forgetItems,
  renameItem,
  restoreItems,
  toggleLike,
  trashItems,
} from '@/lib/user-data';
import { canSetWallpaper, setAsWallpaper } from '@/lib/wallpaper';

const KIND_LABELS = {
  single: 'Photo',
  burst: 'Burst',
  live: 'Live Photo',
  video: 'Video',
  screenshot: 'Screenshot',
} as const;

type Mode = 'menu' | 'rename' | 'move' | 'details';

/**
 * The "⋯" menu for a photo or video: edit, rename, move to the vault, copy, share, set as
 * wallpaper, favorite, details and delete. Deleted items get restore / delete forever instead.
 */
export function ItemActions({
  itemId,
  onClose,
  onRemoved,
  onSelect,
}: {
  itemId: string | null;
  onClose: () => void;
  /** Called after the item is deleted or restored, e.g. so the viewer can close. */
  onRemoved?: () => void;
  /** Shows "Select" (start multi-select with this item) when given. */
  onSelect?: (itemId: string) => void;
}) {
  const { itemsById, data, isVaulted } = useGallery();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('menu');
  const item = itemId ? itemsById.get(itemId) : undefined;

  const close = () => {
    setMode('menu');
    onClose();
  };

  if (!item) return null;

  const title = data.titles[item.id];
  const liked = !!data.likes[item.id];
  const deleted = !!data.trash[item.id];
  const isCopy = item.id.includes('#copy-');
  const edit = data.edits[item.id];

  const actions: {
    label: string;
    icon: { ios: SFSymbol; android: AndroidSymbol };
    color?: string;
    onPress: () => void;
  }[] = deleted
    ? [
        {
          label: 'Restore',
          icon: { ios: 'arrow.uturn.backward', android: 'restore' },
          onPress: () => {
            restoreItems([item.id]);
            showToast('Restored');
            close();
            onRemoved?.();
          },
        },
        {
          label: 'Delete forever',
          icon: { ios: 'trash.slash', android: 'delete_forever' },
          color: '#E5484D',
          onPress: () =>
            confirmAction('Delete forever?', 'This can’t be undone.', 'Delete', async () => {
              close();
              onRemoved?.();
              await deleteFromDevice([item.id]);
              forgetItems([item.id]);
            }),
        },
      ]
    : [
        ...(onSelect
          ? [
              {
                label: 'Select',
                icon: { ios: 'checkmark.circle', android: 'check_circle' } as const,
                onPress: () => {
                  close();
                  onSelect(item.id);
                },
              },
            ]
          : []),
        ...(item.type === 'photo'
          ? [
              {
                label: 'Edit',
                icon: { ios: 'slider.horizontal.3', android: 'tune' } as const,
                onPress: () => {
                  close();
                  router.push({ pathname: '/editor', params: { id: item.id } });
                },
              },
            ]
          : []),
        {
          label: 'Rename',
          icon: { ios: 'pencil', android: 'edit' },
          onPress: () => setMode('rename'),
        },
        {
          label: 'Move to vault',
          icon: { ios: 'lock', android: 'lock' },
          onPress: () => setMode('move'),
        },
        {
          label: 'Make a copy',
          icon: { ios: 'plus.square.on.square', android: 'content_copy' },
          onPress: () => {
            copyItem(item.id);
            showToast('Copy made');
            close();
          },
        },
        {
          label: 'Share',
          icon: { ios: 'square.and.arrow.up', android: 'share' },
          onPress: async () => {
            close();
            await shareItem(item, edit);
          },
        },
        ...(item.type === 'photo' && canSetWallpaper
          ? [
              {
                label: 'Set as wallpaper',
                icon: { ios: 'photo.on.rectangle', android: 'wallpaper' } as const,
                onPress: async () => {
                  close();
                  if (!(await setAsWallpaper(item, edit))) showToast('Can’t set a wallpaper here');
                },
              },
            ]
          : []),
        {
          label: liked ? 'Remove from favorites' : 'Add to favorites',
          icon: liked ? { ios: 'heart.fill', android: 'favorite' } : { ios: 'heart', android: 'favorite_border' },
          color: liked ? LikeColor : undefined,
          onPress: () => {
            toggleLike(item.id);
          },
        },
        {
          label: 'Details',
          icon: { ios: 'info.circle', android: 'info' },
          onPress: () => setMode('details'),
        },
        {
          label: 'Delete',
          icon: { ios: 'trash', android: 'delete' },
          color: '#E5484D',
          onPress: () => {
            // Vault photos are deleted for good (like a phone's locked folder), so they never
            // appear in the public Recently deleted.
            if (isVaulted(item.id)) {
              confirmAction('Delete from vault?', 'Vault photos are deleted permanently.', 'Delete', async () => {
                close();
                onRemoved?.();
                await deleteFromDevice([item.id]);
                forgetItems([item.id]);
              });
              return;
            }
            trashItems([item.id]);
            showToast('Moved to Recently deleted', { label: 'Undo', onPress: () => restoreItems([item.id]) });
            close();
            onRemoved?.();
          },
        },
      ];

  const details: [string, string][] = [
    ['Name', title ?? KIND_LABELS[item.kind]],
    ['Type', `${KIND_LABELS[item.kind]}${isCopy ? ' (copy)' : ''}`],
    ['Size', `${item.width} × ${item.height}`],
    ['Taken', formatDate(item.createdAt)],
    ...(item.duration ? [['Length', formatDuration(item.duration)] as [string, string]] : []),
    ['Edited', isEdited(edit) ? 'Yes (original kept)' : 'No'],
    ['Favorite', liked ? 'Yes' : 'No'],
    ['Stored', 'Only on this device'],
  ];

  return (
    <>
      <Sheet
        visible={mode === 'menu' || mode === 'details'}
        title={mode === 'details' ? 'Details' : (title ?? KIND_LABELS[item.kind])}
        onClose={close}>
        {mode === 'details' ? (
          <View style={styles.details}>
            {details.map(([label, value]) => (
              <View key={label} style={[styles.detailRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText themeColor="textSecondary">{label}</ThemedText>
                <ThemedText style={styles.detailValue}>{value}</ThemedText>
              </View>
            ))}
            <Pressable onPress={() => setMode('menu')} style={styles.back}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Back
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityLabel={action.label}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: theme.backgroundElement },
                  theme.outline > 0 && { borderWidth: theme.outline, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <Icon {...action.icon} size={22} color={action.color} />
                <ThemedText type="small" numberOfLines={2} style={[styles.actionLabel, action.color && { color: action.color }]}>
                  {action.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>
      <TextPrompt
        visible={mode === 'rename'}
        title="Rename"
        placeholder="Give this a name"
        initialValue={title}
        submitLabel="Rename"
        onClose={close}
        onSubmit={(name) => {
          renameItem(item.id, name);
        }}
      />
      <CollectionPicker itemId={mode === 'move' ? item.id : null} onClose={close} />
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  action: {
    width: '31.8%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  actionLabel: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 15,
  },
  details: {
    gap: Spacing.one,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  back: {
    alignSelf: 'center',
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
