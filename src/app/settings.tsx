import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { LibraryBanner } from '@/components/library-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Accents,
  Appearances,
  MaxContentWidth,
  Spacing,
  type AccentName,
} from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { Challenges } from '@/lib/challenges';
import { loadLibrary, requestLibraryAccess, switchToDemoLibrary } from '@/lib/media';
import { notificationsSupported, setReminder } from '@/lib/notifications';
import { confirmAction, openSidePanel } from '@/lib/ui';
import { resetUserData, updateSettings } from '@/lib/user-data';

export default function SettingsScreen() {
  const { library, data, unlocked, vaultCount } = useGallery();
  const accent = useAccent();
  const { settings } = data;

  const toggleReminder = async (kind: 'memoryReminders' | 'challengeReminders', value: boolean) => {
    const ok = await setReminder(kind, value, null);
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for this app in system settings.');
    }
  };

  const confirmReset = () =>
    confirmAction(
      'Erase app data?',
      'Deletes all likes, notes, vault albums, the vault passcode and challenge progress stored by this app. Your photos are not touched.',
      'Erase',
      resetUserData
    );

  const challengeFor = (name: AccentName) =>
    Challenges.find((c) => c.reward.type === 'accent' && c.reward.accent === name)?.title;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar title="Settings" leading="back" />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={styles.privacy}>
            <Icon ios="lock.shield.fill" android="shield" size={28} color={accent} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">100% private, 100% on-device</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your photos are never uploaded. Likes, notes, collections, reels and insights are
                created and stored only on this phone.
              </ThemedText>
            </View>
          </ThemedView>

          <Section title="LIBRARY">
            <Row label="Source" value={library.source === 'device' ? 'Camera roll' : 'Demo media'} />
            <Row label="Items" value={String(library.items.length)} />
            {library.source === 'device' ? (
              <>
                <Button label="Rescan library" onPress={loadLibrary} color={accent} />
                <Button label="Switch to demo media" onPress={switchToDemoLibrary} color={accent} />
              </>
            ) : (
              <Button label="Use my camera roll" onPress={requestLibraryAccess} color={accent} />
            )}
          </Section>
          <LibraryBanner />

          <Section title="PRIVACY">
            <Toggle
              label="Hide photo dates"
              value={settings.hideDates}
              onChange={(v) => {
                updateSettings({ hideDates: v });
              }}
            />
          </Section>

          <Section title="VIDEO PLAYER">
            {(
              [
                ['builtin', 'Built-in player', 'System controls: scrubber, volume, full screen'],
                ['minimal', 'Gallery player', 'Clean and minimal: tap to play or pause'],
                ['external', 'Another app', 'Open videos in VLC, MX Player, Photos…'],
              ] as const
            ).map(([id, label, hint]) => (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ checked: settings.videoPlayer === id }}
                onPress={() => updateSettings({ videoPlayer: id })}
                style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText>{label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {hint}
                  </ThemedText>
                </View>
                <Icon
                  ios={settings.videoPlayer === id ? 'largecircle.fill.circle' : 'circle'}
                  android={settings.videoPlayer === id ? 'radio_button_checked' : 'radio_button_unchecked'}
                  color={settings.videoPlayer === id ? accent : undefined}
                />
              </Pressable>
            ))}
          </Section>

          <Section title="NOTIFICATIONS">
            {!notificationsSupported && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                Reminders aren’t available here. On Android they need a development build
                instead of Expo Go.
              </ThemedText>
            )}
            <Toggle
              disabled={!notificationsSupported}
              label="Morning memories (9:00)"
              value={settings.memoryReminders}
              onChange={(v) => toggleReminder('memoryReminders', v)}
            />
            <Toggle
              disabled={!notificationsSupported}
              label="Evening check-in (20:00)"
              value={settings.challengeReminders}
              onChange={(v) => toggleReminder('challengeReminders', v)}
            />
          </Section>

          <Section title="VAULT">
            <Row label="Status" value={data.vault ? `Locked · ${vaultCount} saved` : 'No passcode yet'} />
            <Button
              label={data.vault ? 'Open vault' : 'Set up vault passcode'}
              onPress={() => router.push('/vault')}
              color={accent}
            />
          </Section>

          <Section title="THEME">
            <Row label="Current" value={Appearances.find((a) => a.id === settings.appearance)?.label ?? ''} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Themes live in one place: open the menu and press and hold the theme circle, then
              slide to Light, Dark, Brutal, Blood Moon or Pop Art.
            </ThemedText>
            <Button
              label="Open the theme circle"
              onPress={() => {
                router.back();
                openSidePanel();
              }}
              color={accent}
            />
          </Section>

          <Section title="ACCENT COLOR">
            <View style={styles.accents}>
              {(Object.keys(Accents) as AccentName[]).map((name) => {
                const isUnlocked = unlocked.accents.has(name);
                const selected = settings.accent === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      if (!isUnlocked) {
                        Alert.alert('Locked theme', `Complete “${challengeFor(name)}” in Insights to unlock it.`);
                        return;
                      }
                      updateSettings({ accent: name });
                    }}
                    style={styles.accent}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: Accents[name].color, opacity: isUnlocked ? 1 : 0.35 },
                        selected && styles.swatchSelected,
                      ]}>
                      {!isUnlocked && <Icon ios="lock.fill" android="lock" size={16} color="#fff" />}
                      {selected && <Icon ios="checkmark" android="check" size={18} color="#fff" />}
                    </View>
                    <ThemedText type="small">{Accents[name].label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <Row label="Cinematic reels" value={unlocked.cinematic ? 'Unlocked' : 'Locked: Weekly Story'} />
          </Section>

          <Section title="YOUR DATA">
            <Row label="Likes" value={String(Object.keys(data.likes).length)} />
            <Row label="Notes" value={String(Object.keys(data.notes).length)} />
            <Row label="Vault albums" value={String(data.collections.length)} />
            <Button label="Erase app data" onPress={confirmReset} color="#E5484D" />
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.card}>
        {children}
      </ThemedView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText>{label}</ThemedText>
      <ThemedText themeColor="textSecondary">{value}</ThemedText>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const accent = useAccent();
  return (
    <View style={styles.row}>
      <ThemedText>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: accent }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function Button({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <ThemedText style={{ color }}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
    gap: Spacing.one,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  privacy: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  accents: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  accent: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  note: {
    paddingTop: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
