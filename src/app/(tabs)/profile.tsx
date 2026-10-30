import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { StoriesRow } from '@/components/stories-row';
import { MediaGrid } from '@/components/media-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { useT, type TKey } from '@/lib/i18n';
import { computeInsights } from '@/lib/insights';
import type { Scope } from '@/lib/scopes';
import { displayProfile } from '@/lib/user-data';

// The vault isn't here: it's only reached from the side panel.
const TABS: { scope: Scope; icon: { ios: 'square.grid.3x3' | 'heart' | 'text.bubble'; android: 'grid_on' | 'favorite_border' | 'chat_bubble' }; empty: TKey }[] = [
  { scope: 'all', icon: { ios: 'square.grid.3x3', android: 'grid_on' }, empty: 'No photos yet.' },
  { scope: 'liked', icon: { ios: 'heart', android: 'favorite_border' }, empty: 'Double-tap a photo to like it.' },
  { scope: 'notes', icon: { ios: 'text.bubble', android: 'chat_bubble' }, empty: 'Your journal notes will appear here.' },
];

export default function ProfileScreen() {
  const { library, data, reels, challenges, itemCount, itemsById, isVaulted, scoped } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  const [tab, setTab] = useState<Scope>('all');
  const insights = computeInsights(library.items, data.openDays, t);
  const profile = displayProfile(data.profile, t);
  // The chosen picture, or the top favorite until one is chosen.
  const picture =
    (profile.avatarId && !isVaulted(profile.avatarId) && itemsById.get(profile.avatarId)) ||
    scoped('liked')[0] ||
    library.items[0];
  const badges = challenges.filter((c) => c.state === 'completed').length;

  const header = (
    <View>
      <View style={styles.profileRow}>
        <View style={[styles.avatarRing, { borderColor: accent }]}>
          {picture ? (
            <Image source={{ uri: picture.thumbUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]} />
          )}
        </View>
        <View style={styles.stats}>
          <Stat value={itemCount} label={t('items')} />
          <Stat value={Object.keys(data.likes).length} label={t('likes')} />
          <Stat value={reels.length} label={t('stories')} />
        </View>
      </View>

      <View style={styles.bio}>
        <ThemedText type="smallBold">{profile.name}</ThemedText>
        {profile.bio ? <ThemedText type="small">{profile.bio}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {t('{n}-day capture streak', { n: insights.captureStreak })} · {t.n(badges, '{n} badge', '{n} badges')}
        </ThemedText>
      </View>

      <View style={styles.buttons}>
        <ProfileButton label={t('Edit profile')} onPress={() => router.push('/edit-profile')} />
        <ProfileButton label={t('Insights')} onPress={() => router.push('/insights')} />
      </View>

      <View style={styles.highlights}>
        <StoriesRow reels={reels} size={58} />
      </View>

      <View style={[styles.tabs, { borderColor: theme.backgroundElement }]}>
        {TABS.map((option) => {
          const active = option.scope === tab;
          return (
            <Pressable
              key={option.scope}
              onPress={() => setTab(option.scope)}
              style={[styles.tab, active && { borderBottomColor: theme.text }]}>
              <Icon {...option.icon} size={22} color={active ? theme.text : theme.textSecondary} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title={profile.username ? `@${profile.username}` : profile.name}
          actions={
            <IconButton label={t('Settings')} onPress={() => router.push('/settings')}>
              <Icon ios="gearshape" android="settings" />
            </IconButton>
          }
        />
        <MediaGrid
          items={scoped(tab)}
          scope={tab}
          likes={data.likes}
          edits={data.edits}
          header={header}
          empty={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {t(TABS.find((option) => option.scope === tab)?.empty ?? 'No photos yet.')}
            </ThemedText>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small">{label}</ThemedText>
    </View>
  );
}

function ProfileButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.flex, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.button}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const AVATAR = 84;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
  },
  avatarRing: {
    padding: 3,
    borderRadius: (AVATAR + 12) / 2,
    borderWidth: 3,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
  },
  bio: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.half,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  button: {
    height: 34,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlights: {
    paddingTop: Spacing.four,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
  pressed: {
    opacity: 0.6,
  },
});
