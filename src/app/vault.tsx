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

const formatWait = (seconds: number) =>
  seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;

/**
 * Everything you save lives here, behind a passcode you set the first time you open it.
 * Saved items are hidden from the feed, reels, albums and search.
 */
export default function VaultScreen() {
  const { data, scoped } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
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
      else if (result === 'locked') fail(`Too many tries. Wait ${formatWait(vaultLockoutSeconds())} and try again.`);
      else fail('Wrong passcode. Try again.');
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
      fail('Passcodes didn’t match. Start over.');
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
      'Reset the vault?',
      'The passcode is removed and everything in the vault is removed from Gallery. Photos stay in your device’s photo library.',
      'Reset',
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
    if (await confirmOwner('Confirm it’s you to reset your vault passcode')) {
      openVault();
      setChanging(true);
      setStage('create');
      setError('');
    } else {
      fail('Fingerprint not recognized.');
    }
  };

  const unlockWithBiometrics = async () => {
    if (await confirmOwner('Unlock your vault')) {
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
                <IconButton label="Cancel" onPress={() => setChanging(false)}>
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
                  ? 'Enter vault passcode'
                  : stage === 'create'
                    ? changing
                      ? 'Choose a new passcode'
                      : 'Create a vault passcode'
                    : 'Confirm your passcode'
              }
              subtitle={
                creating
                  ? 'Saved photos are hidden everywhere else and only open with this code.'
                  : 'Your saved photos are locked.'
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
                    accessibilityLabel="Unlock with fingerprint"
                    style={[styles.biometric, { borderColor: accent }]}>
                    <Icon ios="touchid" android="fingerprint" size={28} color={accent} />
                  </Pressable>
                )}
                <Pressable onPress={forgot} hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: accent }}>
                    {hasBiometrics ? 'Forgot passcode? Use fingerprint' : 'Forgot passcode?'}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const albums = buildAlbums([], data).collections.map((a) => ({
    ...a,
    items: scoped(a.scope),
  }));
  const saved = scoped('saved');

  const open = (album: Album) => router.push({ pathname: '/album', params: { scope: album.scope } });
  const confirmDelete = (album: Album) =>
    confirmAction(`Delete “${album.title}”?`, 'Its photos leave the vault and return to your library.', 'Delete', () =>
      deleteCollection(album.scope.replace('collection:', ''))
    );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title="Vault"
          leading="back"
          actions={
            <>
              <IconButton label="New album" onPress={() => setNaming(true)}>
                <Icon ios="plus" android="add" />
              </IconButton>
              <IconButton
                label="Change passcode"
                onPress={() => {
                  setStage('create');
                  setChanging(true);
                }}>
                <Icon ios="key" android="key" />
              </IconButton>
              <IconButton
                label="Lock vault"
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
                  Unlocked. The vault locks again when you leave it or close the app.
                </ThemedText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albums}>
                <Pressable onPress={() => setNaming(true)} style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.newAlbum, { borderColor: theme.backgroundSelected }]}>
                    <Icon ios="plus" android="add" size={28} color={accent} />
                    <ThemedText type="smallBold" style={{ color: accent }}>
                      New album
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
                All saved · {saved.length}
              </ThemedText>
            </View>
          }
          empty={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Nothing saved yet. Tap the bookmark on any photo to move it into the vault.
            </ThemedText>
          }
        />
      </SafeAreaView>

      <TextPrompt
        visible={naming}
        title="New vault album"
        placeholder="e.g. Private trip"
        submitLabel="Create"
        onClose={() => setNaming(false)}
        onSubmit={(name) => {
          createCollection(name);
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
