import { dateLocale, translator, type Translator } from '@/lib/i18n';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isWeekend(ms: number) {
  const day = new Date(ms).getDay();
  return day === 0 || day === 6;
}

/** Components pass their `useT()` translator, so the date re-renders in a new language. */
export function formatDate(ms: number, t: Translator = translator()) {
  return new Date(ms).toLocaleDateString(dateLocale(t.language), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Instagram-style relative time: "5m", "3h", "2d", "4w", then a date. */
export function timeAgo(ms: number, t: Translator = translator(), now = Date.now()) {
  const minutes = Math.floor((now - ms) / 60000);
  if (minutes < 60) return t('{n}m', { n: Math.max(1, minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('{n}h', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('{n}d', { n: days });
  if (days < 56) return t('{n}w', { n: Math.floor(days / 7) });
  const years = Math.floor(days / 365);
  if (years >= 1) return t.n(years, '1 year ago', '{n} years ago');
  return formatDate(ms, t);
}

export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
