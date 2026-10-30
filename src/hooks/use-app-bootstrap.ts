import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useGallery } from '@/hooks/use-gallery';
import { rewardLabel } from '@/lib/challenges';
import { applyDocumentLanguage, syncLayoutDirection, t, useLanguage } from '@/lib/i18n';
import { demoUserContent } from '@/lib/demo';
import { deleteStored } from '@/lib/local-files';
import { loadLibrary } from '@/lib/media';
import {
  configureNotifications,
  notifyMilestone,
  syncReminders,
  useNotificationDeepLinks,
} from '@/lib/notifications';
import { starterStories } from '@/lib/reels';
import {
  clearDemoContent,
  completeChallenge,
  legacyPdfUris,
  purgeExpiredTrash,
  recordAppOpen,
  seedDemoContent,
  seedStories,
  userData,
} from '@/lib/user-data';

/** App-wide side effects: load media, notifications, deep links and challenge completion. */
export function useAppBootstrap() {
  const { library, challenges } = useGallery();
  const language = useLanguage();

  useEffect(() => {
    syncLayoutDirection();
    recordAppOpen();
    purgeExpiredTrash();
    configureNotifications();
    loadLibrary();
    legacyPdfUris.forEach(deleteStored);
  }, []);

  useEffect(() => applyDocumentLanguage(language), [language]);

  useEffect(() => {
    if (library.status !== 'ready') return;
    // Also re-run on a language change, so scheduled reminders are in the new language.
    syncReminders(null).catch((error) => console.warn('Could not schedule reminders', error));
  }, [library.status, language]);

  // Sample content while there's no camera roll; it's all removed once real photos load.
  useEffect(() => {
    if (library.source === 'demo') seedDemoContent(demoUserContent());
    else if (library.source === 'device') clearDemoContent();
  }, [library.source]);

  // Starter stories, once; after that stories only change when the user edits them.
  useEffect(() => {
    // Waits for the whole library, so starter stories aren't built from the newest photos only.
    if (
      library.source === 'device' &&
      !library.partial &&
      !userData.get().storiesSeeded &&
      library.items.length > 0
    ) {
      seedStories(starterStories(library.items));
    }
  }, [library.source, library.partial, library.items]);

  useNotificationDeepLinks();

  // Celebrate challenges as soon as their goal is reached.
  const finished = challenges.filter((s) => s.state === 'active' && s.progress >= s.challenge.goal);
  useEffect(() => {
    for (const { challenge } of finished) {
      if (userData.get().challenges[challenge.id]?.completedAt) continue;
      completeChallenge(challenge.id);
      const reward = rewardLabel(challenge.reward);
      const title = t(challenge.title);
      notifyMilestone(title, reward).then((shown) => {
        if (!shown) Alert.alert(t('🏆 Challenge complete!'), `${title}\n${t('Unlocked: {reward}', { reward })}`);
      });
    }
  }, [finished]);
}
