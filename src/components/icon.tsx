import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconProps = {
  ios: SFSymbol;
  /** Material Symbols name, also used on web. */
  android: AndroidSymbol;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ ios, android, size = 22, color, style }: IconProps) {
  const theme = useTheme();
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={color ?? theme.text}
      style={style}
    />
  );
}
