import { DAY_MS, dayKey, isWeekend, startOfDay } from '@/lib/dates';
import type { MediaItem } from '@/lib/media';

export type DayCount = { key: string; label: string; count: number };

export function computeInsights(items: MediaItem[], openDays: string[], now = Date.now()) {
  const today = startOfDay(now);
  const perDay = new Map<string, number>();
  for (const item of items) {
    const key = dayKey(item.createdAt);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const lastDays = (count: number): DayCount[] =>
    Array.from({ length: count }, (_, i) => {
      const t = today - (count - 1 - i) * DAY_MS;
      const key = dayKey(t);
      return {
        key,
        label: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }),
        count: perDay.get(key) ?? 0,
      };
    });

  const week = lastDays(7);
  const weekTotal = week.reduce((sum, d) => sum + d.count, 0);

  // 12 full weeks ending today, for the consistency heatmap.
  const heatmap = lastDays(84);

  const last30 = items.filter((i) => i.createdAt >= today - 29 * DAY_MS);
  const weekendShare = last30.length
    ? last30.filter((i) => isWeekend(i.createdAt)).length / last30.length
    : 0;

  const counts = {
    // A burst counts as one photo, like its single tile in the grid.
    photos: items.filter((i) => i.type === 'photo' && (!i.burstId || i.burstId === i.id)).length,
    videos: items.filter((i) => i.type === 'video').length,
    live: items.filter((i) => i.kind === 'live').length,
    bursts: new Set(items.map((i) => i.burstId).filter(Boolean)).size,
    burstExtras: items.filter((i) => i.burstId && i.burstId !== i.id).length,
    screenshots: items.filter((i) => i.kind === 'screenshot').length,
  };

  const clutter = counts.screenshots + counts.burstExtras;
  const cleanliness = items.length ? Math.round(100 * (1 - clutter / items.length)) : 100;

  return {
    week,
    weekTotal,
    heatmap,
    counts,
    clutter,
    cleanliness,
    headline: headline(weekTotal, weekendShare),
    captureStreak: streak((key) => perDay.has(key), today),
    openStreak: streak((key) => openDays.includes(key), today),
    activeDays: heatmap.filter((d) => d.count > 0).length,
  };
}

function headline(weekTotal: number, weekendShare: number) {
  if (weekTotal === 0) return 'A quiet week. Your camera is waiting for the next moment.';
  const moments = `You captured ${weekTotal} ${weekTotal === 1 ? 'photo' : 'photos'} this week`;
  if (weekendShare > 0.5) return `${moments}, mostly on weekends!`;
  if (weekendShare < 0.2) return `${moments}, mostly on weekdays.`;
  return `${moments}, spread across the week.`;
}

/** Consecutive days (ending today, or yesterday if today has nothing yet). */
function streak(has: (key: string) => boolean, today: number) {
  let day = has(dayKey(today)) ? today : today - DAY_MS;
  let count = 0;
  while (has(dayKey(day))) {
    count++;
    day -= DAY_MS;
  }
  return count;
}
