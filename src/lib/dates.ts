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

export function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Instagram-style relative time: "5m", "3h", "2d", "4w", then a date. */
export function timeAgo(ms: number, now = Date.now()) {
  const minutes = Math.floor((now - ms) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 56) return `${Math.floor(days / 7)}w`;
  const years = Math.floor(days / 365);
  if (years >= 1) return years === 1 ? '1 year ago' : `${years} years ago`;
  return formatDate(ms);
}

export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
