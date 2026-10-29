/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#E0E1E6',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#2E3135',
  },
  /** Neo-brutalism: cream paper, pure black ink, loud yellow highlights. */
  brutal: {
    text: '#000000',
    background: '#FFF4D6',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#FFD23F',
    textSecondary: '#3B3B3B',
    border: '#000000',
  },
  /** Gothic hunter's night: soot black, bone-white type, dried-blood red, tarnished bronze. */
  gothic: {
    text: '#E8DCC4',
    background: '#0B0908',
    backgroundElement: '#17110F',
    backgroundSelected: '#2B1D18',
    textSecondary: '#9C8C74',
    border: '#5A4630',
  },
  /** Pop art comic: Ben-Day yellow, ink outlines, primary red and cyan. */
  pop: {
    text: '#111111',
    background: '#FFE94A',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#3EC6F0',
    textSecondary: '#2A2A2A',
    border: '#111111',
  },
} as const;

export type ThemeName = keyof typeof Colors;
export type ThemeColor = keyof typeof Colors.light;

type ThemeTokens = {
  /** Comic-style surfaces: thick ink outlines, hard offset shadows, heavy uppercase titles. */
  brutal: boolean;
  dark: boolean;
  /** Outline width of raised surfaces (`ThemedView type="backgroundElement"`). 0 = none. */
  outline: number;
  shadow: string | undefined;
  /** Serif display type for titles. */
  serif: boolean;
  /** Overrides the user's accent color while this theme is active. */
  accent: string | undefined;
  /** Color behind the phone frame on desktop browsers. */
  desk: string;
};

/** Non-color tokens per theme. */
export const ThemeStyles: Record<ThemeName, ThemeTokens> = {
  light: { brutal: false, dark: false, outline: 0, shadow: undefined, serif: false, accent: undefined, desk: '#E9EBEF' },
  dark: { brutal: false, dark: true, outline: 0, shadow: undefined, serif: false, accent: undefined, desk: '#111214' },
  brutal: {
    brutal: true,
    dark: false,
    outline: 2.5,
    shadow: '4px 4px 0px #000000',
    serif: false,
    accent: undefined,
    desk: '#FFD23F',
  },
  gothic: {
    brutal: false,
    dark: true,
    outline: 1,
    shadow: '0px 6px 20px rgba(120, 8, 8, 0.35)',
    serif: true,
    accent: '#A4161A',
    desk: '#1A0A0A',
  },
  pop: {
    brutal: true,
    dark: false,
    outline: 3,
    shadow: '5px 5px 0px #E4002B',
    serif: false,
    accent: '#E4002B',
    desk: '#3EC6F0',
  },
};

export type Appearance = 'system' | ThemeName;

/** Every appearance, in theme-wheel order, with the two colors its swatch shows. */
export const Appearances: { id: Appearance; label: string; swatch: [string, string] }[] = [
  { id: 'system', label: 'System', swatch: ['#ffffff', '#000000'] },
  { id: 'light', label: 'Light', swatch: ['#ffffff', '#E0E1E6'] },
  { id: 'dark', label: 'Dark', swatch: ['#000000', '#2E3135'] },
  { id: 'brutal', label: 'Brutal', swatch: ['#FFF4D6', '#FFD23F'] },
  { id: 'gothic', label: 'Blood Moon', swatch: ['#0B0908', '#A4161A'] },
  { id: 'pop', label: 'Pop Art', swatch: ['#FFE94A', '#E4002B'] },
];

/** App accent themes. Everything except `classic` is unlocked by completing challenges. */
export const Accents = {
  classic: { label: 'Classic', color: '#3c87f7' },
  sunset: { label: 'Sunset', color: '#F2555A' },
  aurora: { label: 'Aurora', color: '#2BB673' },
  amethyst: { label: 'Amethyst', color: '#8E5CF7' },
  gold: { label: 'Gold', color: '#E0A526' },
} as const;

export type AccentName = keyof typeof Accents;

export const LikeColor = '#FF3B5C';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Bottom padding that keeps scrolling content clear of the floating tab bar. */
export const BottomTabInset = 104;
export const MaxContentWidth = 800;

/** On web the app renders inside a phone-sized frame (Pixel-class width). */
export const FrameWidth = 412;
export const FrameHeight = 880;
/** Width of the phone's bezel around the screen. */
export const FrameBezel = 8;
/** Browsers narrower than this get the app full-screen instead of in a frame. */
export const FrameBreakpoint = FrameWidth + 32;
