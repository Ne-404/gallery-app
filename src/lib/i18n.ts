import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { I18nManager, Platform } from 'react-native';

import { ar } from '@/locales/ar';
import { tr } from '@/locales/tr';
import { flushUserData, updateSettings, userData } from '@/lib/user-data';

/**
 * App languages. English strings are the keys; `tr` lists every key, and `ar` must cover
 * the same keys, so a string without a translation fails the typecheck. A key that means
 * two things gets a `|context` suffix, which English drops.
 */
export type Language = 'en' | 'ar' | 'tr';
export type LanguageSetting = 'system' | Language;
export type TKey = keyof typeof tr;
type Params = Record<string, string | number>;

/** Each language is labeled in itself, so it can be found from any language. */
export const Languages: { id: LanguageSetting; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'tr', label: 'Türkçe' },
];

const dictionaries: Record<Exclude<Language, 'en'>, Record<TKey, string>> = { ar, tr };

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'ar' || code === 'tr' ? code : 'en';
}

export function resolveLanguage(setting: LanguageSetting | undefined): Language {
  return !setting || setting === 'system' ? deviceLanguage() : setting;
}

const currentLanguage = () => resolveLanguage(userData.get().settings.language);

function translate(language: Language, key: TKey, params?: Params) {
  const text: string = language === 'en' ? key.replace(/\|.*$/, '') : dictionaries[language][key];
  return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '')) : text;
}

function makeTranslator(language: Language) {
  const fn = (key: TKey, params?: Params) => translate(language, key, params);
  /** Picks the singular or plural key for `n` (passed to the string as `{n}`). */
  fn.n = (n: number, one: TKey, other: TKey) => translate(language, n === 1 ? one : other, { n });
  fn.language = language;
  return fn;
}

export type Translator = ReturnType<typeof makeTranslator>;

// One translator per language, so its identity only changes with the language.
const translators: Record<Language, Translator> = {
  en: makeTranslator('en'),
  ar: makeTranslator('ar'),
  tr: makeTranslator('tr'),
};

/** The translator for the current language, for code outside React (toasts, notifications). */
export const translator = () => translators[currentLanguage()];

export function t(key: TKey, params?: Params) {
  return translator()(key, params);
}

export function tn(n: number, one: TKey, other: TKey) {
  return translator().n(n, one, other);
}

// Read lazily: lib modules that user-data imports also import this one.
const subscribeLanguage = (listener: () => void) => userData.subscribe(listener);
const getLanguageSetting = () => userData.get().settings.language;

export function useLanguage() {
  // Selects just the setting, so other data changes don't re-render every caller.
  return resolveLanguage(useSyncExternalStore(subscribeLanguage, getLanguageSetting, getLanguageSetting));
}

/**
 * The translator for the current language. Components re-render when it changes; pass it to
 * helpers like `timeAgo` so the React Compiler's memoized output depends on the language.
 */
export function useT() {
  return translators[useLanguage()];
}

/** BCP 47 locale for dates, with Latin digits so numbers match the rest of the UI. */
export function dateLocale(language: Language = currentLanguage()) {
  const device = getLocales()[0];
  const tag = device?.languageCode === language ? device.languageTag : language;
  return language === 'ar' ? `${tag}-u-nu-latn` : tag;
}

/**
 * Whether the layout runs right to left. Native layout direction is fixed for the session
 * (changing it reloads the app); web flips live through `<html dir>`.
 */
export function useIsRTL() {
  const language = useLanguage();
  return Platform.OS === 'web' ? language === 'ar' : I18nManager.isRTL;
}

const wantsRTL = (language: Language) => language === 'ar';

/** Asks native for the language's layout direction; it applies from the next launch. */
function requestDirection(language: Language) {
  if (Platform.OS === 'web') return false;
  const rtl = wantsRTL(language);
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true;
}

/** Keeps native direction in step with the saved language (e.g. after the device language changed). */
export function syncLayoutDirection() {
  requestDirection(currentLanguage());
}

export function setLanguage(setting: LanguageSetting) {
  updateSettings({ language: setting });
  if (requestDirection(resolveLanguage(setting))) {
    // Switching to or from Arabic flips the layout, which native only does on a fresh start.
    flushUserData();
    reloadAppAsync('Layout direction changed').catch(() => {});
  }
}

/** Web: mirrors the language onto `<html>` so the browser lays the page out and reads it correctly. */
export function applyDocumentLanguage(language: Language) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = wantsRTL(language) ? 'rtl' : 'ltr';
}
