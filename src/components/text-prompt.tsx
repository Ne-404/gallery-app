import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-gallery';
import { useTheme } from '@/hooks/use-theme';

type TextPromptProps = {
  visible: boolean;
  title: string;
  placeholder: string;
  initialValue?: string;
  submitLabel: string;
  multiline?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

export function TextPrompt({ visible, title, onClose, ...rest }: TextPromptProps) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {/* Content unmounts while hidden, so the field starts fresh each time. */}
      {visible && <PromptBody onClose={onClose} {...rest} />}
    </Sheet>
  );
}

/** Composer with an inline confirm (✓) button; Enter also confirms. */
function PromptBody({
  placeholder,
  initialValue = '',
  submitLabel,
  multiline,
  onSubmit,
  onClose,
}: Omit<TextPromptProps, 'visible' | 'title'>) {
  const theme = useTheme();
  const accent = useAccent();
  const [value, setValue] = useState(initialValue);
  // Allow confirming an empty field only when it clears an existing value (deletes a note).
  const canConfirm = value.trim().length > 0 || initialValue.length > 0;

  const confirm = () => {
    if (!canConfirm) return;
    onSubmit(value);
    onClose();
  };

  return (
    <>
      <View
        style={[
          styles.composer,
          { backgroundColor: theme.backgroundElement },
          theme.brutal && { borderWidth: theme.outline, borderColor: theme.border, boxShadow: theme.shadow },
        ]}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          autoFocus
          multiline={multiline}
          submitBehavior="submit"
          onSubmitEditing={confirm}
          returnKeyType="done"
          style={[styles.input, multiline && styles.multiline, { color: theme.text }, noFocusRing]}
        />
        <Pressable
          onPress={confirm}
          disabled={!canConfirm}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          style={({ pressed }) => [
            styles.confirm,
            { backgroundColor: canConfirm ? accent : theme.backgroundSelected },
            theme.brutal && { borderWidth: 2, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <Icon ios="checkmark" android="check" size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={confirm}
          disabled={!canConfirm}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" style={{ color: canConfirm ? accent : theme.textSecondary }}>
            {submitLabel}
          </ThemedText>
        </Pressable>
      </View>
    </>
  );
}

// Our fields have their own container styling, so drop the browser's focus outline.
const noFocusRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderRadius: Spacing.four,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one + 2,
    paddingVertical: Spacing.one + 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
    minHeight: 40,
  },
  multiline: {
    minHeight: 72,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  confirm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
