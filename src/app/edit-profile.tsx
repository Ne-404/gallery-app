import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, IconButton } from '@/components/app-bar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppWidth } from '@/hooks/use-app-width';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';
import { updateProfile } from '@/lib/user-data';

const COLUMNS = 4;
const GAP = 2;
const AVATAR = 96;

/** Edit the profile: picture (any photo in the gallery), name, username and bio. */
export default function EditProfileScreen() {
  const { library, itemsById, data } = useGallery();
  const accent = useAccent();
  const theme = useTheme();
  const width = useAppWidth();
  const [name, setName] = useState(data.profile.name);
  const [username, setUsername] = useState(data.profile.username);
  const [bio, setBio] = useState(data.profile.bio);
  const [avatarId, setAvatarId] = useState(data.profile.avatarId);
  const [picking, setPicking] = useState(false);
  const avatar = avatarId ? itemsById.get(avatarId) : undefined;
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const save = () => {
    updateProfile({
      name: name.trim() || 'My Gallery',
      username: username.trim().replace(/^@/, '').replace(/\s+/g, '_').toLowerCase(),
      bio: bio.trim(),
      avatarId,
    });
    close();
  };

  const form = (
    <View style={styles.form}>
      <Pressable
        onPress={() => {
          setPicking((p) => !p);
        }}
        accessibilityLabel="Change profile photo"
        style={styles.avatarBlock}>
        <View style={[styles.avatarRing, { borderColor: accent }]}>
          {avatar ? (
            <Image source={{ uri: avatar.thumbUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: theme.backgroundElement }]}>
              <Icon ios="person.fill" android="person" size={40} color={theme.textSecondary} />
            </View>
          )}
        </View>
        <ThemedText type="smallBold" style={{ color: accent }}>
          {picking ? 'Choose a photo below' : 'Change photo'}
        </ThemedText>
      </Pressable>

      {!picking && (
        <>
          <Field label="Name" value={name} onChange={setName} placeholder="Your name" maxLength={40} />
          <Field label="Username" value={username} onChange={setUsername} placeholder="username" maxLength={30} prefix="@" />
          <Field label="Bio" value={bio} onChange={setBio} placeholder="A line about you" maxLength={150} multiline />
          {avatarId && (
            <Pressable onPress={() => setAvatarId(undefined)} style={styles.reset}>
              <ThemedText type="small" themeColor="textSecondary">
                Use my top favorite as the picture instead
              </ThemedText>
            </Pressable>
          )}
        </>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <AppBar
          title="Edit profile"
          leading="close"
          actions={
            <IconButton label="Save profile" onPress={save}>
              <Icon ios="checkmark" android="check" color={accent} />
            </IconButton>
          }
        />
        <FlatList
          data={picking ? library.items.filter((i) => i.type === 'photo') : []}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={form}
          // Rows, not tiles (numColumns): one screenful, so opening doesn't load every thumbnail.
          initialNumToRender={8}
          windowSize={3}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setAvatarId(item.id);
                setPicking(false);
              }}
              accessibilityLabel="Use as profile photo"
              style={{ width: tile, height: tile }}>
              <Image source={{ uri: item.thumbUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {item.id === avatarId && <View style={[StyleSheet.absoluteFill, styles.chosen, { borderColor: accent }]} />}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  multiline,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  prefix?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fieldBlock}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedView type="backgroundElement" style={styles.field}>
        {prefix && <ThemedText themeColor="textSecondary">{prefix}</ThemedText>}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label}
          maxLength={maxLength}
          multiline={multiline}
          autoCapitalize={prefix ? 'none' : 'sentences'}
          style={[styles.input, multiline && styles.multiline, { color: theme.text }, noFocusRing]}
        />
      </ThemedView>
    </View>
  );
}

const noFocusRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  avatarBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatarRing: {
    padding: 3,
    borderRadius: (AVATAR + 12) / 2,
    borderWidth: 3,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldBlock: {
    gap: Spacing.one,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.three,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reset: {
    alignSelf: 'center',
  },
  gridRow: {
    gap: GAP,
    marginBottom: GAP,
  },
  chosen: {
    borderWidth: 4,
  },
});
