import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { router, usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { MiniPlayer } from '@/components/mini-player';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Vinyl } from '@/components/vinyl';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { isSwipeBlocked } from '@/lib/ui';

const TABS: {
  name: string;
  href: '/' | '/music' | '/reels' | '/profile';
  label: string;
  icon: { ios: SFSymbol; iosActive: SFSymbol; android: AndroidSymbol };
}[] = [
  { name: 'index', href: '/', label: 'Home', icon: { ios: 'house', iosActive: 'house.fill', android: 'home' } },
  // Drawn as a spinning record rather than a symbol (see NavItem).
  {
    name: 'music',
    href: '/music',
    label: 'Music',
    icon: { ios: 'opticaldisc', iosActive: 'opticaldisc.fill', android: 'album' },
  },
  {
    name: 'reels',
    href: '/reels',
    label: 'Videos',
    icon: { ios: 'play.square', iosActive: 'play.square.fill', android: 'movie' },
  },
  {
    name: 'profile',
    href: '/profile',
    label: 'Profile',
    icon: { ios: 'person.crop.circle', iosActive: 'person.crop.circle.fill', android: 'account_circle' },
  },
];

/**
 * Floating Material 3 navigation bar, shared by every platform. Screens scroll underneath
 * it, so scrollable content pads its bottom with `BottomTabInset`.
 */
export default function AppTabs() {
  const pathname = usePathname();
  const current = Math.max(0, TABS.findIndex((t) => t.href === pathname));
  const go = (step: number) => {
    const next = TABS[current + step];
    if (next) router.navigate(next.href);
  };
  const swipeTo = (step: number) => {
    if (!isSwipeBlocked()) go(step);
  };

  // Slide left or right anywhere on a tab to move to the neighbouring tab. It only starts
  // on a clearly sideways drag (vertical scrolling cancels it), and sliders opt out.
  const swipe = usePanGesture({
    activeOffsetX: [-30, 30],
    failOffsetY: [-18, 18],
    cancelsJSResponder: false,
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX < -80 || e.velocityX < -800) scheduleOnRN(swipeTo, 1);
      else if (e.translationX > 80 || e.velocityX > 800) scheduleOnRN(swipeTo, -1);
    },
  });
  return (
    <Tabs style={styles.root}>
      <GestureDetector gesture={swipe}>
        <View style={styles.root}>
          <TabSlot style={styles.root} />
        </View>
      </GestureDetector>
      <MiniPlayer />
      <TabList asChild>
        <NavigationBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <NavItem label={tab.label} icon={tab.icon} />
            </TabTrigger>
          ))}
        </NavigationBar>
      </TabList>
    </Tabs>
  );
}

function NavigationBar({ children, ...props }: { children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ThemedView
      type="backgroundElement"
      {...props}
      style={[
        styles.bar,
        { bottom: insets.bottom + Spacing.three },
        theme.outline === 0 && { boxShadow: theme.dark ? '0px 8px 28px rgba(0,0,0,0.6)' : '0px 8px 28px rgba(0,0,0,0.16)' },
        theme.brutal && styles.barBrutal,
        theme.retro && styles.barRetro,
      ]}>
      {children}
    </ThemedView>
  );
}

function NavItem({
  label,
  icon,
  isFocused,
  onPress,
}: TabTriggerSlotProps & { label: string; icon: (typeof TABS)[number]['icon'] }) {
  const theme = useTheme();
  const accent = useAccent();
  const jump = useSharedValue(0);

  // A quick hop with a springy landing on every press.
  const jumpStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: jump.get() * -7 }, { scale: 1 + jump.get() * 0.18 }],
  }));

  const activeColor = theme.brutal ? '#000' : accent;

  return (
    <Pressable
      onPress={(e) => {
        jump.set(withSequence(withTiming(1, { duration: 110 }), withSpring(0, { damping: 10, stiffness: 300 })));
        onPress?.(e);
      }}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}>
      <Animated.View
        style={[
          styles.indicator,
          isFocused && { backgroundColor: theme.brutal ? accent : `${accent}2E` },
          isFocused && theme.brutal && { borderWidth: 2, borderColor: theme.border },
          theme.retro && styles.indicatorRetro,
          isFocused && theme.retro && { backgroundColor: theme.backgroundSelected, boxShadow: sunken },
          jumpStyle,
        ]}>
        {label === 'Music' ? (
          // The record player tab: a record that never stops turning.
          <Vinyl size={20} color={isFocused ? activeColor : theme.textSecondary} spinning period={2.4} />
        ) : (
          <Icon
            ios={isFocused ? icon.iosActive : icon.ios}
            android={icon.android}
            size={20}
            color={isFocused ? activeColor : theme.textSecondary}
          />
        )}
      </Animated.View>
      <ThemedText
        style={[styles.label, { color: isFocused ? theme.text : theme.textSecondary }, isFocused && styles.labelActive]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const sunken = 'inset 1px 1px 0px #808080, inset -1px -1px 0px #FFFFFF';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // A compact pill centered above the content, so the four items sit close together.
  bar: {
    position: 'absolute',
    alignSelf: 'center',
    width: 296,
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 30,
    paddingHorizontal: Spacing.one,
  },
  barBrutal: {
    borderRadius: 18,
  },
  // Windows 98: the tab bar becomes a taskbar, with the active tab pressed in.
  barRetro: {
    borderRadius: 2,
  },
  indicatorRetro: {
    borderRadius: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  indicator: {
    width: 46,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: 500,
  },
  labelActive: {
    fontWeight: 700,
  },
});
