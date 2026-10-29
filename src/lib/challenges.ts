import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import { Accents, type AccentName } from '@/constants/theme';
import { DAY_MS, dayKey } from '@/lib/dates';
import type { MediaItem } from '@/lib/media';
import type { UserData } from '@/lib/user-data';

export type Reward = { type: 'accent'; accent: AccentName } | { type: 'effect'; effect: 'cinematic' };

export type Challenge = {
  id: string;
  title: string;
  description: string;
  goal: number;
  durationDays: number;
  reward: Reward;
  icon: { ios: SFSymbol; android: AndroidSymbol };
  progress: (ctx: { items: Map<string, MediaItem>; data: UserData; startedAt: number }) => number;
};

const YEAR_MS = 365 * DAY_MS;

export const Challenges: Challenge[] = [
  {
    id: 'rediscover',
    title: 'Rediscover 10 forgotten photos',
    description: 'Like 10 photos that are more than a year old.',
    goal: 10,
    durationDays: 7,
    reward: { type: 'accent', accent: 'sunset' },
    icon: { ios: 'sparkles', android: 'auto_awesome' },
    progress: ({ items, data, startedAt }) =>
      Object.entries(data.likes).filter(([id, likedAt]) => {
        const item = items.get(id);
        return likedAt >= startedAt && item && likedAt - item.createdAt > YEAR_MS;
      }).length,
  },
  {
    id: 'clean-up',
    title: '7-Day Clean-Up',
    description: 'Sort 20 photos or screenshots into collections.',
    goal: 20,
    durationDays: 7,
    reward: { type: 'accent', accent: 'aurora' },
    icon: { ios: 'tray.full', android: 'grid_view' },
    progress: ({ data, startedAt }) =>
      new Set(
        data.collections.flatMap((c) =>
          c.items.filter((e) => e.addedAt >= startedAt).map((e) => e.id)
        )
      ).size,
  },
  {
    id: 'weekly-story',
    title: 'Weekly Story',
    description: 'Curate an album of 8 photos from the past week.',
    goal: 8,
    durationDays: 7,
    reward: { type: 'effect', effect: 'cinematic' },
    icon: { ios: 'film', android: 'movie' },
    progress: ({ items, data, startedAt }) =>
      Math.max(
        0,
        ...data.collections.map(
          (c) =>
            c.items.filter((e) => {
              const item = items.get(e.id);
              return e.addedAt >= startedAt && item && e.addedAt - item.createdAt <= 7 * DAY_MS;
            }).length
        )
      ),
  },
  {
    id: 'streak',
    title: 'Memory Streak',
    description: 'Open your gallery 7 days in a row.',
    goal: 7,
    durationDays: 10,
    reward: { type: 'accent', accent: 'amethyst' },
    icon: { ios: 'flame', android: 'local_fire_department' },
    progress: ({ data, startedAt }) => {
      let count = 0;
      for (let day = Date.now(); day >= startedAt - DAY_MS; day -= DAY_MS) {
        if (!data.openDays.includes(dayKey(day))) break;
        count++;
      }
      return count;
    },
  },
  {
    id: 'journal',
    title: 'Memory Journal',
    description: 'Write private notes on 5 photos.',
    goal: 5,
    durationDays: 7,
    reward: { type: 'accent', accent: 'gold' },
    icon: { ios: 'book', android: 'edit_note' },
    progress: ({ data, startedAt }) =>
      Object.values(data.notes).filter((n) => n.updatedAt >= startedAt).length,
  },
];

export type ChallengeStatus = {
  challenge: Challenge;
  state: 'available' | 'active' | 'completed' | 'expired';
  progress: number;
  daysLeft: number;
};

export function challengeStatuses(items: Map<string, MediaItem>, data: UserData): ChallengeStatus[] {
  return Challenges.map((challenge) => {
    const saved = data.challenges[challenge.id];
    if (!saved) return { challenge, state: 'available', progress: 0, daysLeft: challenge.durationDays };
    if (saved.completedAt) {
      return { challenge, state: 'completed', progress: challenge.goal, daysLeft: 0 };
    }
    const progress = Math.min(
      challenge.goal,
      challenge.progress({ items, data, startedAt: saved.startedAt })
    );
    const endsAt = saved.startedAt + challenge.durationDays * DAY_MS;
    const daysLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / DAY_MS));
    return { challenge, state: daysLeft > 0 ? 'active' : 'expired', progress, daysLeft };
  });
}

export function rewardLabel(reward: Reward) {
  return reward.type === 'accent'
    ? `${Accents[reward.accent].label} theme`
    : 'Cinematic reel effect';
}

export function unlockedRewards(data: UserData) {
  const completed = Challenges.filter((c) => data.challenges[c.id]?.completedAt);
  return {
    accents: new Set<AccentName>([
      'classic',
      ...completed.flatMap((c) => (c.reward.type === 'accent' ? [c.reward.accent] : [])),
    ]),
    cinematic: completed.some((c) => c.reward.type === 'effect'),
  };
}
