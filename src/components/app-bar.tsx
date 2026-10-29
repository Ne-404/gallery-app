import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openSidePanel } from '@/lib/ui';

type AppBarProps = {
  title: string;
  /** `menu` opens the side panel, `back` pops the stack. */
  leading?: 'menu' | 'back' | 'close' | null;
  /** Large stylized wordmark, used on Home. */
  brand?: boolean;
  actions?: ReactNode;
};

/** Material 3 style top app bar. */
export function AppBar({ title, leading = 'menu', brand, actions }: AppBarProps) {
  const theme = useTheme();
  return (
    <View style={styles.bar}>
      {leading && (
        <IconButton
          label={leading === 'menu' ? 'Open menu' : 'Back'}
          onPress={
            leading === 'menu'
              ? openSidePanel
              : () => (router.canGoBack() ? router.back() : router.replace('/'))
          }>
          {leading === 'menu' && <Icon ios="line.3.horizontal" android="menu" />}
          {leading === 'back' && <Icon ios="chevron.left" android="arrow_back" />}
          {leading === 'close' && <Icon ios="xmark" android="close" />}
        </IconButton>
      )}
      <ThemedText
        numberOfLines={1}
        style={[
          styles.title,
          brand && styles.brand,
          theme.brutal && styles.brutalTitle,
          theme.serif && styles.gothicTitle,
          theme.retro && styles.retroTitle,
        ]}>
        {title}
      </ThemedText>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

export function IconButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    gap: Spacing.one,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 600,
    paddingHorizontal: Spacing.two,
  },
  brand: {
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  brutalTitle: {
    fontWeight: 900,
    fontStyle: 'normal',
    fontFamily: undefined,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  gothicTitle: {
    fontFamily: Fonts.serif,
    fontStyle: 'normal',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  retroTitle: {
    fontFamily: Fonts.retro,
    fontStyle: 'normal',
    fontWeight: 700,
    letterSpacing: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
});
