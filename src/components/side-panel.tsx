import { router, type Href } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useThemeWheel } from '@/components/theme-wheel';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAccent, type useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { closeSidePanel } from '@/lib/ui';

type Entry = {
  label: string;
  href: Href;
  icon: { ios: SFSymbol; android: AndroidSymbol };
  count?: number;
};

const PANEL_WIDTH = 300;

/**
 * Navigation drawer holding the social-style features, themes and app sections.
 * It stays mounted (off-screen and non-interactive while closed) so its hooks never change.
 */
export function SidePanel({
  open,
  gallery,
}: {
  open: boolean;
  gallery: ReturnType<typeof useGallery>;
}) {
  const { library, data, challenges, reels } = gallery;
  const accent = useAccent();
  const theme = useTheme();
  const root = useRef<ComponentRef<typeof View>>(null);
  const wheel = useThemeWheel(root);
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    // Ease out: fast start, gentle stop, which reads smoother than a linear slide.
    progress.set(withTiming(open ? 1 : 0, { duration: open ? 280 : 220, easing: Easing.out(Easing.cubic) }));
  }, [open, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.get() - 1) * (PANEL_WIDTH + 24) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() * 0.5 }));

  const activeChallenges = challenges.filter((c) => c.state === 'active').length;

  const sections: { title: string; entries: Entry[] }[] = [
    {
      title: 'Your activity',
      entries: [
        {
          label: 'Liked',
          href: { pathname: '/album', params: { scope: 'liked' } },
          icon: { ios: 'heart', android: 'favorite_border' },
          count: Object.keys(data.likes).length,
        },
        {
          label: 'Vault',
          href: '/vault',
          icon: { ios: 'lock.rectangle.stack', android: 'lock' },
        },
        {
          label: 'Notes',
          href: '/notes',
          icon: { ios: 'text.bubble', android: 'chat_bubble' },
          count: Object.keys(data.notes).length + data.journal.length || undefined,
        },
        {
          label: 'Edited photos',
          href: { pathname: '/album', params: { scope: 'edited' } },
          icon: { ios: 'wand.and.stars', android: 'auto_fix_high' },
          count: Object.keys(data.edits).length,
        },
      ],
    },
    {
      title: 'Discover',
      entries: [
        { label: 'Search', href: '/search', icon: { ios: 'magnifyingglass', android: 'search' } },
        {
          label: 'Stories',
          href: '/stories',
          icon: { ios: 'sparkles', android: 'auto_awesome' },
          count: reels.length || undefined,
        },
        {
          label: 'Insights & challenges',
          href: '/insights',
          icon: { ios: 'chart.bar.xaxis', android: 'insights' },
          count: activeChallenges || undefined,
        },
        {
          label: 'PDF reader',
          href: '/pdfs',
          icon: { ios: 'book', android: 'menu_book' },
          count: data.pdfs.length || undefined,
        },
        {
          label: 'Albums',
          href: '/albums',
          icon: { ios: 'rectangle.stack', android: 'photo_library' },
        },
      ],
    },
    {
      title: 'App',
      entries: [
        {
          label: 'Trash',
          href: { pathname: '/album', params: { scope: 'trash' } },
          icon: { ios: 'trash', android: 'delete' },
          count: gallery.trashCount || undefined,
        },
        { label: 'Settings', href: '/settings', icon: { ios: 'gearshape', android: 'settings' } },
        {
          label: 'Privacy hub',
          href: '/settings',
          icon: { ios: 'lock.shield', android: 'shield' },
        },
      ],
    },
  ];

  const go = (href: Href) => {
    closeSidePanel();
    router.navigate(href);
  };

  return (
    <View
      ref={root}
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'box-none' : 'none'}
      aria-hidden={!open}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSidePanel}
          accessibilityLabel="Close menu"
        />
      </Animated.View>
      <Animated.View style={[styles.panel, panelStyle]}>
        <ThemedView
          style={[
            styles.panelInner,
            { paddingTop: insets.top + Spacing.three },
            theme.brutal && { borderRightWidth: 3, borderColor: theme.border, borderRadius: 0 },
          ]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={[styles.brand, theme.serif && styles.brandGothic]}>Gallery</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {library.items.length} items · {wheel.label} theme
              </ThemedText>
            </View>
            {wheel.trigger}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                  {section.title}
                </ThemedText>
                {section.entries.map((entry) => (
                  <Pressable
                    key={entry.label}
                    onPress={() => go(entry.href)}
                    style={({ pressed }) => [
                      styles.entry,
                      pressed && { backgroundColor: theme.backgroundElement },
                    ]}>
                    <Icon {...entry.icon} />
                    <ThemedText style={styles.entryLabel}>{entry.label}</ThemedText>
                    {entry.count ? (
                      <View style={[styles.count, { backgroundColor: accent }]}>
                        <ThemedText style={styles.countText}>{entry.count}</ThemedText>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
            <Icon ios="lock.fill" android="lock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Everything stays on this device
            </ThemedText>
          </View>
        </ThemedView>
      </Animated.View>
      {wheel.overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scroll: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  scrim: {
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    maxWidth: '85%',
  },
  panelInner: {
    flex: 1,
    borderTopRightRadius: Spacing.four,
    borderBottomRightRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  brand: {
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
  },
  brandGothic: {
    fontStyle: 'normal',
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 24,
  },
  section: {
    gap: Spacing.half,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 24,
  },
  entryLabel: {
    flex: 1,
    fontSize: 15,
  },
  count: {
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
