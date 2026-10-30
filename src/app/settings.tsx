import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { libraryNotice } from '@/components/library-banner';
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
import { useTheme } from '@/hooks/use-theme';
import { Challenges } from '@/lib/challenges';
import { Languages, resolveLanguage, setLanguage, useIsRTL, useT } from '@/lib/i18n';
import { loadLibrary } from '@/lib/media';
import { notificationsSupported, setReminder } from '@/lib/notifications';
import { confirmAction, openSidePanel } from '@/lib/ui';
import { resetUserData, updateSettings } from '@/lib/user-data';

export default function SettingsScreen() {
  const { library, data, unlocked, itemCount, vaultCount } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  // Native swaps `left` in right-to-left layouts; web doesn't.
  const isRTL = useIsRTL();
  const labelAlign = Platform.OS === 'web' && isRTL ? 'right' : 'left';
  const { settings } = data;
  const notice = libraryNotice(library, t);

  const toggleReminder = async (kind: 'memoryReminders' | 'challengeReminders', value: boolean) => {
    const ok = await setReminder(kind, value, null);
    if (!ok) {
      Alert.alert(t('Notifications are off'), t('Allow notifications for this app in system settings.'));
    }
  };

  const confirmReset = () =>
    confirmAction(
      t('Erase app data?'),
      t('Deletes all likes, notes, vault albums, the vault passcode and challenge progress stored by this app. Your photos are not touched.'),
      t('Erase'),
      resetUserData
    );

  const challengeFor = (name: AccentName) => {
    const challenge = Challenges.find((c) => c.reward.type === 'accent' && c.reward.accent === name);
    return challenge ? t(challenge.title) : '';
  };
  // Arabic lays the app out right to left; on a phone that takes a quick restart.
  const flipsLayout = (id: (typeof Languages)[number]['id']) =>
    Platform.OS !== 'web' && (resolveLanguage(id) === 'ar') !== (resolveLanguage(settings.language) === 'ar');
  const chooseLanguage = (id: (typeof Languages)[number]['id']) => {
    if (id === settings.language) return;
    if (!flipsLayout(id)) setLanguage(id);
    else confirmAction(t('Change language?'), t('Gally-ri restarts to switch the layout direction.'), t('Restart'), () => setLanguage(id));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar title={t('Settings')} leading="back" />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={styles.privacy}>
            <Icon ios="lock.shield.fill" android="shield" size={28} color={accent} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t('100% private, 100% on-device')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Your photos are never uploaded. Likes, notes, collections, reels and insights are created and stored only on this phone.')}
              </ThemedText>
            </View>
          </ThemedView>

          <Section title={t('LANGUAGE')}>
            {Languages.map(({ id, label }, i) => (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ checked: settings.language === id }}
                onPress={() => chooseLanguage(id)}
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                <View style={styles.flex}>
                  {/* Languages are named in themselves; "System" follows the app language. */}
                  {/* Aligned with the app, not the label's own script (العربية in an English UI). */}
                  <ThemedText style={{ textAlign: labelAlign }}>{id === 'system' ? t('System') : label}</ThemedText>
                </View>
                <Icon
                  ios={settings.language === id ? 'largecircle.fill.circle' : 'circle'}
                  android={settings.language === id ? 'radio_button_checked' : 'radio_button_unchecked'}
                  color={settings.language === id ? accent : undefined}
                />
              </Pressable>
            ))}
          </Section>

          <Section title={t('LIBRARY')}>
            <Row label={t('Source')} value={
                library.source === 'device'
                  ? t('Camera roll')
                  : library.source === 'demo'
                    ? t('Sample photos')
                    : t('Not connected')
              } />
            <Row label={t('Items')} value={String(itemCount)} />
            {library.source === 'device' ? (
              <Button label={t('Rescan library')} onPress={loadLibrary} color={accent} />
            ) : (
              // The camera roll button only shows where it can work (not on web or in Expo Go).
              notice && (
                <>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
                    {notice.message}
                  </ThemedText>
                  {notice.action && <Button label={notice.action.label} onPress={notice.action.onPress} color={accent} />}
                </>
              )
            )}
          </Section>

          <Section title={t('PRIVACY')}>
            <Toggle
              label={t('Hide photo dates')}
              value={settings.hideDates}
              onChange={(v) => {
                updateSettings({ hideDates: v });
              }}
            />
          </Section>

          <Section title={t('NOTIFICATIONS')}>
            {!notificationsSupported && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                {t('Reminders aren’t available here. On Android they need a development build instead of Expo Go.')}
              </ThemedText>
            )}
            <Toggle
              disabled={!notificationsSupported}
              label={t('Morning memories (9:00)')}
              value={settings.memoryReminders}
              onChange={(v) => toggleReminder('memoryReminders', v)}
            />
            <Toggle
              disabled={!notificationsSupported}
              label={t('Evening check-in (20:00)')}
              value={settings.challengeReminders}
              onChange={(v) => toggleReminder('challengeReminders', v)}
            />
          </Section>

          <Section title={t('VAULT')}>
            <Row label={t('Status')} value={data.vault ? t('Locked · {n} saved', { n: vaultCount }) : t('No passcode yet')} />
            <Button
              label={data.vault ? t('Open vault') : t('Set up vault passcode')}
              onPress={() => router.push('/vault')}
              color={accent}
            />
          </Section>

          <Section title={t('THEME')}>
            <Row
              label={t('Current')}
              value={(() => {
                const current = Appearances.find((a) => a.id === settings.appearance);
                return current ? t(current.label) : '';
              })()}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              {t('Themes live in one place: open the menu and press and hold the theme circle, then slide to Light, Dark, Brutal, Pop Art or Pirate.')}
            </ThemedText>
            <Button
              label={t('Open the theme circle')}
              onPress={() => {
                router.back();
                openSidePanel();
              }}
              color={accent}
            />
          </Section>

          <Section title={t('ACCENT COLOR')}>
            <View style={styles.accents}>
              {(Object.keys(Accents) as AccentName[]).map((name) => {
                const isUnlocked = unlocked.accents.has(name);
                const selected = settings.accent === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      if (!isUnlocked) {
                        Alert.alert(t('Locked theme'), t('Complete “{name}” in Insights to unlock it.', { name: challengeFor(name) }));
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
                    <ThemedText type="small">{t(Accents[name].label)}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <Row label={t('Cinematic reels')} value={unlocked.cinematic ? t('Unlocked') : t('Locked: Weekly Story')} />
          </Section>

          <Section title={t('YOUR DATA')}>
            <Row label={t('Likes')} value={String(Object.keys(data.likes).length)} />
            <Row label={t('Notes')} value={String(Object.keys(data.notes).length)} />
            <Row label={t('Vault albums')} value={String(data.collections.length)} />
            <Button label={t('Erase app data')} onPress={confirmReset} color="#E5484D" />
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
    <View style={[styles.row, styles.split]}>
      <ThemedText style={styles.shrink}>{label}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.shrink}>
        {value}
      </ThemedText>
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
  // Long labels (Turkish, small phones) wrap instead of pushing the value off screen.
  split: {
    gap: Spacing.three,
  },
  shrink: {
    flexShrink: 1,
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
  // Two-line choices need room: padding and a divider tell them apart.
  noticeText: {
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
