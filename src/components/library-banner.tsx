import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useT, type Translator } from '@/lib/i18n';
import { requestLibraryAccess, useLibrary, type LibraryState, type PermissionState } from '@/lib/media';
import { isAndroidExpoGo } from '@/lib/platform';
import { updateSettings, useUserData } from '@/lib/user-data';

type Notice = { message: string; action: { label: string; onPress: () => void } | null };

/**
 * Why no photos are showing, and the way to connect the camera roll when there is one (null when
 * it's already in use). Shared by the Home banner and Settings.
 */
export function libraryNotice(
  { source, permission }: Pick<LibraryState, 'source' | 'permission'>,
  t: Translator
): Notice | null {
  if (source === 'device') return null;
  const notice = cameraRollNotice(permission, t);
  // Sample photos stand in until the camera roll is connected.
  return source === 'demo' ? { ...notice, message: `${t('Showing sample photos.')} ${notice.message}` } : notice;
}

function cameraRollNotice(permission: PermissionState, t: Translator): Notice {
  if (Platform.OS === 'web') {
    return { message: t('Open the app on your phone to see your camera roll.'), action: null };
  }
  if (isAndroidExpoGo || permission === 'unavailable') {
    return {
      message: t('On Android, full photo library access needs a development build instead of Expo Go.'),
      action: null,
    };
  }
  if (permission === 'denied') {
    return {
      message: t('Photo access is turned off. Allow it in system settings to see your own photos.'),
      action: { label: t('Open Settings'), onPress: () => Linking.openSettings() },
    };
  }
  return {
    message: t('Connect your camera roll to see your photos.'),
    action: { label: t('Use my photos'), onPress: requestLibraryAccess },
  };
}

/** The Home banner version of `libraryNotice`, which can be closed for good. */
export function LibraryBanner() {
  const library = useLibrary();
  const dismissed = useUserData().settings.libraryBannerDismissed;
  const accent = useAccent();
  const t = useT();
  const notice = libraryNotice(library, t);
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
      <IconButton label={t('Hide this message')} onPress={() => updateSettings({ libraryBannerDismissed: true })}>
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
    paddingEnd: Spacing.one,
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
