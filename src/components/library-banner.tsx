import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { requestLibraryAccess, useLibrary } from '@/lib/media';
import { isAndroidExpoGo } from '@/lib/platform';

/** Explains why demo media is showing and offers the right way to connect real photos. */
export function LibraryBanner() {
  const { source, permission } = useLibrary();
  const accent = useAccent();
  if (source === 'device') return null;

  let message = 'You’re browsing demo media. Connect your camera roll to see your own photos.';
  let action: { label: string; onPress: () => void } | null = {
    label: 'Use my photos',
    onPress: requestLibraryAccess,
  };

  if (Platform.OS === 'web') {
    message = 'You’re browsing demo media. Open the app on your phone to use your camera roll.';
    action = null;
  } else if (isAndroidExpoGo || permission === 'unavailable') {
    message =
      'You’re browsing demo media. On Android, full photo library access needs a development build instead of Expo Go.';
    action = null;
  } else if (permission === 'denied') {
    message = 'Photo access is turned off. Allow it in system settings to see your own photos.';
    action = { label: 'Open Settings', onPress: () => Linking.openSettings() };
  }

  return (
    <ThemedView type="backgroundElement" style={styles.banner}>
      <Icon ios="lock.shield" android="shield" color={accent} />
      <View style={styles.text}>
        <ThemedText type="small">{message}</ThemedText>
        {action && (
          <Pressable onPress={action.onPress} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="smallBold" style={{ color: accent }}>
              {action.label}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
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
