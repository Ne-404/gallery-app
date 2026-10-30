import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Platform, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { isDirectional, mirrorStyle } from '@/components/icon-direction';
import { useTheme } from '@/hooks/use-theme';
import { useIsRTL } from '@/lib/i18n';

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
  const mirrored = useIsRTL() && Platform.OS === 'android' && isDirectional(android);
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={color ?? theme.text}
      style={[style, mirrored && mirrorStyle]}
    />
  );
}
