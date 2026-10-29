import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { FrameBezel, FrameBreakpoint, FrameHeight, FrameWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Renders the app as an Android phone on desktop browsers; on narrow (mobile) browsers
 * it fills the screen like an installed app.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const colors = useTheme();
  const framed = width > FrameBreakpoint;
  // Sheets portal into this host so they layer above the tab bar but stay inside the phone.
  const overlayHost = (
    <View nativeID={OVERLAY_HOST_ID} style={StyleSheet.absoluteFill} pointerEvents="box-none" />
  );

  if (!framed) {
    return (
      <View style={[styles.full, { backgroundColor: colors.background }]}>
        {children}
        {overlayHost}
      </View>
    );
  }

  return (
    <View style={[styles.desk, { backgroundColor: colors.desk }, colors.name === 'pop' && halftone]}>
      <View
        style={[
          styles.phone,
          {
            backgroundColor: colors.background,
            height: Math.min(FrameHeight, height - 48),
          },
          colors.brutal && styles.brutalPhone,
          colors.retro && styles.retroPhone,
        ]}>
        {children}
        {overlayHost}
      </View>
    </View>
  );
}

// Ben-Day dots behind the phone in the Pop Art theme (web-only CSS background).
const halftone = {
  backgroundImage: 'radial-gradient(#E4002B 22%, transparent 24%)',
  backgroundSize: '18px 18px',
} as object;

export const OVERLAY_HOST_ID = 'overlay-host';

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
  desk: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brutalPhone: {
    borderRadius: 20,
    borderColor: '#000000',
    boxShadow: '10px 10px 0px #000000',
  },
  // Windows 98: a square, beveled window instead of a phone bezel.
  retroPhone: {
    // Keeps the bezel width: useAppWidth() subtracts FrameBezel.
    borderRadius: 0,
    borderColor: '#C0C0C0',
    boxShadow: 'inset -1px -1px 0px #000000, inset 1px 1px 0px #FFFFFF, 2px 2px 0px #000000',
  },
  phone: {
    width: FrameWidth,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: FrameBezel,
    borderColor: '#1A1B1E',
    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
  },
});
