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
import { createCollection, toggleInCollection, useUserData } from '@/lib/user-data';

type CollectionPickerProps = {
  itemId: string | null;
  onClose: () => void;
};

export function CollectionPicker({ itemId, onClose }: CollectionPickerProps) {
  const { collections } = useUserData();
  const accent = useAccent();
  const t = useT();
  const [naming, setNaming] = useState(false);

  const toggle = (collectionId: string) => {
    if (!itemId) return;
    toggleInCollection(collectionId, itemId);
  };

  return (
    <>
      <Sheet visible={itemId !== null && !naming} title={t('Move to vault')} onClose={onClose}>
        <ScrollView contentContainerStyle={styles.list}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {t('🔒 Saved photos are hidden from your feed and only open with your vault passcode.')}
          </ThemedText>
          <Pressable onPress={() => setNaming(true)} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.row}>
              <Icon ios="plus" android="add" color={accent} />
              <ThemedText style={{ color: accent }}>{t('New vault album')}</ThemedText>
            </ThemedView>
          </Pressable>
          {collections.map((c) => {
            const saved = !!itemId && c.items.some((e) => e.id === itemId);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggle(c.id)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <Icon ios="rectangle.stack" android="grid_view" />
                  <View style={styles.rowText}>
                    <ThemedText>{c.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t.n(c.items.length, '{n} item', '{n} items')}
                    </ThemedText>
                  </View>
                  {saved && <Icon ios="checkmark.circle.fill" android="check" color={accent} />}
                </ThemedView>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
      <TextPrompt
        visible={naming}
        title={t('New vault album')}
        placeholder={t('e.g. Summer trip')}
        submitLabel={t('Create & save')}
        onClose={() => setNaming(false)}
        onSubmit={(name) => {
          const id = createCollection(name.trim() || t('Untitled'));
          if (itemId) toggleInCollection(id, itemId);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  note: {
    textAlign: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
