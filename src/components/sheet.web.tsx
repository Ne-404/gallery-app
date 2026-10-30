import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { OVERLAY_HOST_ID } from '@/components/app-frame.web';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFeedWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Web bottom sheet. A Modal would portal to the page body (outside the phone frame), so it
 * portals into the frame's overlay host instead, above the tab bar.
 */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  if (!visible) return null;
  const host = typeof document === 'undefined' ? null : document.getElementById(OVERLAY_HOST_ID);
  const sheet = (
    <SheetBody title={title} onClose={onClose}>
      {children}
    </SheetBody>
  );
  return host ? createPortal(sheet, host) : sheet;
}

/** Mounted while visible: fades the backdrop in and slides the sheet up a little. */
function SheetBody({ title, onClose, children }: Omit<SheetProps, 'visible'>) {
  const theme = useTheme();
  const t = useT();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
  }, [shown]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - shown.get()) * 40 }] }));

  return (
    <Animated.View style={[styles.backdrop, backdropStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('Close')} />
      <Animated.View style={[styles.sheetFrame, sheetStyle]}>
        <ThemedView
          style={[
            styles.sheet,
            theme.brutal && { borderTopWidth: 3, borderColor: theme.border, borderRadius: 0 },
          ]}>
          <ThemedView type="backgroundSelected" style={styles.handle} />
          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>
          {children}
        </ThemedView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // Holds the height limit; the sheet shrinks inside it when content is taller.
  sheetFrame: {
    maxHeight: '75%',
    width: '100%',
    maxWidth: MaxFeedWidth,
    alignSelf: 'center',
  },
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
  },
});
