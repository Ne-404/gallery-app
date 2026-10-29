/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, ThemeStyles, type ThemeName } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserData } from '@/lib/user-data';

/** The active theme: the user's Appearance choice, or the system scheme for `system`. */
export function useThemeName(): ThemeName {
  const scheme = useColorScheme();
  const appearance = useUserData().settings.appearance;
  if (appearance === 'system') return scheme === 'dark' ? 'dark' : 'light';
  return appearance;
}

export function useTheme() {
  const name = useThemeName();
  return { ...Colors[name], ...ThemeStyles[name], name };
}
