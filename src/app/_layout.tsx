import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppFrame } from '@/components/app-frame';
import { ExportHost } from '@/components/export-host';
import { SidePanel } from '@/components/side-panel';
import { ToastHost } from '@/components/toast-host';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { registerSidePanel } from '@/lib/ui';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  useAppBootstrap();
  const gallery = useGallery();
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => {
    registerSidePanel(setPanelOpen);
    return () => registerSidePanel(null);
  }, []);

  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <GestureHandlerRootView style={styles.root}>
    <ThemeProvider value={navigationTheme}>
      <AppFrame>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="album" />
          <Stack.Screen name="albums" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="vault" />
          <Stack.Screen name="pdfs" />
          <Stack.Screen name="notes" />
          <Stack.Screen name="note" />
          <Stack.Screen name="pdf" />
          <Stack.Screen name="story" options={{ presentation: 'modal' }} />
          <Stack.Screen name="stories" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="search" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="viewer"
            // A short fade so photos open quickly.
            options={{ presentation: 'fullScreenModal', animation: 'fade', animationDuration: 180 }}
          />
          <Stack.Screen
            name="editor"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
        </Stack>
        <SidePanel open={panelOpen} gallery={gallery} />
        <ExportHost />
        <ToastHost />
      </AppFrame>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
