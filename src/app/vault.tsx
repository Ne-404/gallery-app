import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumCard } from '@/components/album-card';
import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { MediaGrid } from '@/components/media-grid';
import { PinPad } from '@/components/pin-pad';
import { TextPrompt } from '@/components/text-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { biometricsAvailable, confirmOwner } from '@/lib/biometrics';
import { useT, type Translator } from '@/lib/i18n';
import { buildAlbums, type Album } from '@/lib/scopes';
import { confirmAction } from '@/lib/ui';
import {
  createCollection,
  deleteCollection,
  resetVault,
  setVaultPasscode,
  vaultLockoutSeconds,
} from '@/lib/user-data';
import { lockVault, openVault, unlockVault, useVaultUnlocked } from '@/lib/vault';

type Stage = 'enter' | 'create' | 'confirm';

const formatWait = (seconds: number, t: Translator) =>
  seconds >= 60 ? t('{n} min', { n: Math.ceil(seconds / 60) }) : t('{n} s', { n: seconds });

/**
 * Everything you save lives here, behind a passcode you set the first time you open it.
 * Saved items are hidden from the feed, reels, albums and search.
 */
export default function VaultScreen() {
  const { data, scoped } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const t = useT();
  const unlocked = useVaultUnlocked();
  const [stage, setStage] = useState<Stage>(data.vault ? 'enter' : 'create');
  const [firstEntry, setFirstEntry] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [changing, setChanging] = useState(false);
  const [naming, setNaming] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    biometricsAvailable().then(setHasBiometrics);
  }, []);

  // Leaving the vault locks it again.
  useEffect(() => lockVault, []);

  const fail = (message: string) => {
    setError(message);
    setAttempt((a) => a + 1);
  };

  const onPasscode = (passcode: string) => {
    if (stage === 'enter') {
      const result = unlockVault(passcode);
      if (result === 'ok') setError('');
      else if (result === 'locked') fail(t('Too many tries. Wait {time} and try again.', { time: formatWait(vaultLockoutSeconds(), t) }));
      else fail(t('Wrong passcode. Try again.'));
      return;
    }
    if (stage === 'create') {
      setFirstEntry(passcode);
      setError('');
      setStage('confirm');
      return;
    }
    if (passcode !== firstEntry) {
      setStage('create');
      fail(t('Passcodes didn’t match. Start over.'));
      return;
    }
    setVaultPasscode(passcode);
    openVault();
    setChanging(false);
    setError('');
    setStage('enter');
  };

  const resetEverything = () =>
    confirmAction(
      t('Reset the vault?'),
      t('The passcode is removed and everything in the vault is removed from Gally-ri. Photos stay in your device’s photo library.'),
      t('Reset'),
      () => {
        resetVault();
        setError('');
        setStage('create');
      }
    );

  // Recovery: the owner's fingerprint (or face) proves who they are, so they can choose a
  // new passcode and keep everything in the vault. Without biometrics, only a reset remains.
  const forgot = async () => {
    if (!hasBiometrics) {
      resetEverything();
      return;
    }
    if (await confirmOwner(t('Confirm it’s you to reset your vault passcode'))) {
      openVault();
      setChanging(true);
      setStage('create');
      setError('');
    } else {
      fail(t('Fingerprint not recognized.'));
    }
  };

  const unlockWithBiometrics = async () => {
    if (await confirmOwner(t('Unlock your vault'))) {
      openVault();
    }
  };

  if (!unlocked || changing || !data.vault) {
    const creating = stage !== 'enter';
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.container}>
          <AppBar
            title=""
            leading="back"
            actions={
              changing ? (
                <IconButton label={t('Cancel')} onPress={() => setChanging(false)}>
                  <Icon ios="xmark" android="close" />
                </IconButton>
              ) : null
            }
          />
          <View style={styles.lockScreen}>
            <PinPad
              key={stage}
              title={
                stage === 'enter'
                  ? t('Enter vault passcode')
                  : stage === 'create'
                    ? changing
                      ? t('Choose a new passcode')
                      : t('Create a vault passcode')
                    : t('Confirm your passcode')
              }
              subtitle={
                creating
                  ? t('Saved photos are hidden everywhere else and only open with this code.')
                  : t('Your saved photos are locked.')
              }
              error={error}
              attempt={attempt}
              onComplete={onPasscode}
            />
            {stage === 'enter' && !changing && (
              <View style={styles.lockActions}>
                {hasBiometrics && (
                  <Pressable
                    onPress={unlockWithBiometrics}
                    accessibilityLabel={t('Unlock with fingerprint')}
                    style={[styles.biometric, { borderColor: accent }]}>
                    <Icon ios="touchid" android="fingerprint" size={28} color={accent} />
                  </Pressable>
                )}
                <Pressable onPress={forgot} hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: accent }}>
                    {hasBiometrics ? t('Forgot passcode? Use fingerprint') : t('Forgot passcode?')}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const albums = buildAlbums([], data, t).collections.map((a) => ({
    ...a,
    items: scoped(a.scope),
  }));
  const saved = scoped('saved');

  const open = (album: Album) => router.push({ pathname: '/album', params: { scope: album.scope } });
  const confirmDelete = (album: Album) =>
    confirmAction(t('Delete “{name}”?', { name: album.title }), t('Its photos leave the vault and return to your library.'), t('Delete'), () =>
      deleteCollection(album.scope.replace('collection:', ''))
    );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title={t('Vault')}
          leading="back"
          actions={
            <>
              <IconButton label={t('New album')} onPress={() => setNaming(true)}>
                <Icon ios="plus" android="add" />
              </IconButton>
              <IconButton
                label={t('Change passcode')}
                onPress={() => {
                  setStage('create');
                  setChanging(true);
                }}>
                <Icon ios="key" android="key" />
              </IconButton>
              <IconButton
                label={t('Lock vault')}
                onPress={() => {
                  lockVault();
                  if (router.canGoBack()) router.back();
                }}>
                <Icon ios="lock" android="lock" />
              </IconButton>
            </>
          }
        />
        <MediaGrid
          items={saved}
          scope="saved"
          likes={data.likes}
          edits={data.edits}
          header={
            <View style={styles.header}>
              <View style={[styles.banner, { backgroundColor: `${accent}1F` }]}>
                <Icon ios="lock.open.fill" android="lock_open" size={18} color={accent} />
                <ThemedText type="small" style={styles.flex}>
                  {t('Unlocked. The vault locks again when you leave it or close the app.')}
                </ThemedText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albums}>
                <Pressable onPress={() => setNaming(true)} style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.newAlbum, { borderColor: theme.backgroundSelected }]}>
                    <Icon ios="plus" android="add" size={28} color={accent} />
                    <ThemedText type="smallBold" style={{ color: accent }}>
                      {t('New album')}
                    </ThemedText>
                  </View>
                </Pressable>
                {albums.map((album) => (
                  <AlbumCard
                    key={album.scope}
                    album={album}
                    size={120}
                    onPress={() => open(album)}
                    onLongPress={() => confirmDelete(album)}
                  />
                ))}
              </ScrollView>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                {t('All saved')} · {saved.length}
              </ThemedText>
            </View>
          }
          empty={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {t('Nothing saved yet. Tap the bookmark on any photo to move it into the vault.')}
            </ThemedText>
          }
        />
      </SafeAreaView>

      <TextPrompt
        visible={naming}
        title={t('New vault album')}
        placeholder={t('e.g. Private trip')}
        submitLabel={t('Create')}
        onClose={() => setNaming(false)}
        onSubmit={(name) => {
          createCollection(name.trim() || t('Untitled'));
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  lockActions: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  biometric: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  albums: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  newAlbum: {
    width: 120,
    height: 120,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.three,
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
  pressed: {
    opacity: 0.6,
  },
});
