import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { requestLibraryAccess, useLibrary, type LibraryState } from '@/lib/media';
import { isAndroidExpoGo } from '@/lib/platform';
import { updateSettings, useUserData } from '@/lib/user-data';

type Notice = { message: string; action: { label: string; onPress: () => void } | null };

/**
 * Why demo media is showing, and the way to connect real photos when there is one (null when
 * the camera roll is already in use). Shared by the Home banner and Settings.
 */
export function libraryNotice({ source, permission }: Pick<LibraryState, 'source' | 'permission'>): Notice | null {
  if (source === 'device') return null;
  if (Platform.OS === 'web') {
    return { message: 'You’re browsing demo media. Open the app on your phone to use your camera roll.', action: null };
  }
  if (isAndroidExpoGo || permission === 'unavailable') {
    return {
      message:
        'You’re browsing demo media. On Android, full photo library access needs a development build instead of Expo Go.',
      action: null,
    };
  }
  if (permission === 'denied') {
    return {
      message: 'Photo access is turned off. Allow it in system settings to see your own photos.',
      action: { label: 'Open Settings', onPress: () => Linking.openSettings() },
    };
  }
  return {
    message: 'You’re browsing demo media. Connect your camera roll to see your own photos.',
    action: { label: 'Use my photos', onPress: requestLibraryAccess },
  };
}

/** The Home banner version of `libraryNotice`, which can be closed for good. */
export function LibraryBanner() {
  const library = useLibrary();
  const dismissed = useUserData().settings.libraryBannerDismissed;
  const accent = useAccent();
  const notice = libraryNotice(library);
  if (!notice || dismissed) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.banner}>
      <Icon ios="lock.shield" android="shield" color={accent} />
      <View style={styles.text}>
        <ThemedText type="small">{notice.message}</ThemedText>
        {notice.action && (
          <Pressable onPress={notice.action.onPress} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="smallBold" style={{ color: accent }}>
              {notice.action.label}
            </ThemedText>
          </Pressable>
        )}
      </View>
      <IconButton label="Hide this message" onPress={() => updateSettings({ libraryBannerDismissed: true })}>
        <Icon ios="xmark" android="close" size={18} />
      </IconButton>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingRight: Spacing.one,
    borderRadius: Spacing.three,
    marginHorizontal: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
