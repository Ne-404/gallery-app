import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { FrameBezel, FrameHeight, FrameWidth } from '@/constants/theme';
import { useFramed } from '@/hooks/use-app-width';
import { useTheme } from '@/hooks/use-theme';

/**
 * Renders the app as an Android phone on desktop browsers; on phones, tablets and narrow
 * windows it fills the screen like an installed app.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  const colors = useTheme();
  const framed = useFramed();
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
    <View style={[styles.desk, { backgroundColor: colors.desk }, colors.name === 'pop' && halftone, colors.name === 'pirate' && moonlitSea]}>
      <View
        style={[
          styles.phone,
          {
            backgroundColor: colors.background,
            height: Math.min(FrameHeight, height - 48),
          },
          colors.brutal && styles.brutalPhone,
          colors.name === 'pirate' && styles.piratePhone,
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

// Moonlight over dark water behind the phone in the Pirate theme (web-only CSS background).
const moonlitSea = {
  backgroundImage:
    'radial-gradient(circle at 78% 18%, rgba(242,227,194,0.55) 0, rgba(242,227,194,0.12) 4%, transparent 12%), ' +
    'linear-gradient(180deg, #061019 0%, #0B2233 62%, #0E3047 100%)',
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
  // Pirate: a brass-trimmed bezel with a faint gold glow.
  piratePhone: {
    borderColor: '#5E4520',
    boxShadow: '0 0 0 2px #D4A537, 0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(212,165,55,0.15)',
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
