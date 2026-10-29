import { loadAsync } from 'expo-font';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import WebIcons from '@/constants/web-icons.json';
import { useTheme } from '@/hooks/use-theme';
import { createStore } from '@/lib/create-store';

type IconProps = {
  ios: SFSymbol;
  /** Material Symbols name, also used on web. */
  android: AndroidSymbol;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

/**
 * Web draws icons from a subset of Material Symbols (`npm run icons`): a few KB instead of
 * the ~1 MB font `SymbolView` loads. Icons missing from the subset fall back to `SymbolView`.
 */
const FAMILY = 'MaterialSymbolsSubset';
const codepoints: Record<string, number> = WebIcons;
const fontReady = createStore(false);
const useFontReady = fontReady.use;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a Metro asset, which has no import typing
loadAsync({ [FAMILY]: require('@/assets/fonts/material-symbols.woff2') })
  .then(() => fontReady.set(true))
  .catch(() => {});

export function Icon({ ios, android, size = 22, color, style }: IconProps) {
  const theme = useTheme();
  const ready = useFontReady();
  const codepoint = codepoints[android];

  if (codepoint === undefined) {
    return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color ?? theme.text} style={style} />;
  }
  return (
    <View style={[{ width: size, height: size }, style]}>
      {ready && (
        <Text
          aria-hidden
          style={{ fontFamily: FAMILY, color: color ?? theme.text, fontSize: size, lineHeight: size }}>
          {String.fromCharCode(codepoint)}
        </Text>
      )}
    </View>
  );
}
