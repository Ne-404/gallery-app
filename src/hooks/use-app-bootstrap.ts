import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useGallery } from '@/hooks/use-gallery';
import { rewardLabel } from '@/lib/challenges';
import { loadLibrary } from '@/lib/media';
import {
  configureNotifications,
  notifyMilestone,
  syncReminders,
  useNotificationDeepLinks,
} from '@/lib/notifications';
import { starterStories } from '@/lib/reels';
import { completeChallenge, purgeExpiredTrash, recordAppOpen, seedStories, userData } from '@/lib/user-data';

/** App-wide side effects: load media, notifications, deep links and challenge completion. */
export function useAppBootstrap() {
  const { library, challenges } = useGallery();

  useEffect(() => {
    recordAppOpen();
    purgeExpiredTrash();
    configureNotifications();
    loadLibrary();
  }, []);

  useEffect(() => {
    if (library.status !== 'ready') return;
    syncReminders(null).catch((error) => console.warn('Could not schedule reminders', error));
  }, [library.status]);

  // Starter stories, once; after that stories only change when the user edits them.
  useEffect(() => {
    if (library.status === 'ready' && !userData.get().storiesSeeded && library.items.length > 0) {
      seedStories(starterStories(library.items));
    }
  }, [library.status, library.items]);

  useNotificationDeepLinks();

  // Celebrate challenges as soon as their goal is reached.
  const finished = challenges.filter((s) => s.state === 'active' && s.progress >= s.challenge.goal);
  useEffect(() => {
    for (const { challenge } of finished) {
      if (userData.get().challenges[challenge.id]?.completedAt) continue;
      completeChallenge(challenge.id);
      const reward = rewardLabel(challenge.reward);
      notifyMilestone(challenge.title, reward).then((shown) => {
        if (!shown) Alert.alert('🏆 Challenge complete!', `${challenge.title}\nUnlocked: ${reward}`);
      });
    }
  }, [finished]);
}
