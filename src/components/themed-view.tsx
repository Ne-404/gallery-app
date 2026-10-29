import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  // Outlined themes (Brutal, Pop Art, Blood Moon) frame every raised surface.
  const raised =
    theme.outline > 0 && type === 'backgroundElement'
      ? { borderWidth: theme.outline, borderColor: theme.border, boxShadow: theme.shadow }
      : null;
  // Windows 98 windows are square; larger radii are circles (avatars, keys) and stay round.
  const radius = raised && theme.retro ? StyleSheet.flatten(style)?.borderRadius : undefined;
  const square = typeof radius === 'number' && radius > 0 && radius <= 24 ? { borderRadius: 2 } : null;

  return (
    <View style={[{ backgroundColor: theme[type ?? 'background'] }, raised, style, square]} {...otherProps} />
  );
}
