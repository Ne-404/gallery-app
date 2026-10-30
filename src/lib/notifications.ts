import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { t, tn } from '@/lib/i18n';
import { isAndroidExpoGo } from '@/lib/platform';
import { updateSettings, userData } from '@/lib/user-data';

/** All notifications are local; nothing is sent to a server. */

type NotificationsModule = typeof import('expo-notifications');

/**
 * `expo-notifications` throws on import in Expo Go on Android (it requires a push-topic
 * native module Expo Go doesn't ship), so it's only loaded where that module exists.
 * Checking for the module itself is more reliable than detecting Expo Go.
 */
function loadNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web' || isAndroidExpoGo) return null;
  if (Platform.OS === 'android' && !requireOptionalNativeModule('ExpoTopicSubscriptionModule')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy, see above
    return require('expo-notifications');
  } catch {
    return null;
  }
}

const Notifications = loadNotifications();

export const notificationsSupported = Notifications !== null;

const CHANNEL_ID = 'memories';
const MORNING_HOUR = 9;
const EVENING_HOUR = 20;

export type NotificationData = { url?: string };

export function configureNotifications() {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('Memories & challenges'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Opens the screen a tapped notification points to (also covers cold starts). */
export const useNotificationDeepLinks = Notifications
  ? function useNotificationDeepLinks() {
      const response = Notifications.useLastNotificationResponse();
      useEffect(() => {
        if (!response) return;
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const { url } = response.notification.request.content.data as NotificationData;
        // Only in-app paths: never follow anything that could leave the app.
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
          router.navigate(url as Parameters<typeof router.navigate>[0]);
        }
        Notifications.clearLastNotificationResponse();
      }, [response]);
    }
  : () => {};

/** Asks for permission; returns whether notifications can be shown. */
async function ensurePermission() {
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function setReminder(
  kind: 'memoryReminders' | 'challengeReminders',
  enabled: boolean,
  memoryYearsAgo: number | null
) {
  if (enabled && !(await ensurePermission())) return false;
  updateSettings({ [kind]: enabled });
  await syncReminders(memoryYearsAgo);
  return true;
}

/**
 * Re-schedules the daily reminders from current settings. Called on every launch so
 * the morning memory text reflects what's actually in the library.
 */
export async function syncReminders(memoryYearsAgo: number | null) {
  if (!Notifications) return;
  const { memoryReminders, challengeReminders } = userData.get().settings;
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (memoryReminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('✨ Memories'),
        body: memoryYearsAgo
          ? tn(
              memoryYearsAgo,
              'Look what you captured on this day {n} year ago...',
              'Look what you captured on this day {n} years ago...'
            )
          : t('Take a minute to relive this week in your gallery.'),
        data: { url: '/stories' } satisfies NotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: MORNING_HOUR,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  }

  if (challengeReminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('Today in your gallery'),
        body: t('Review what you captured today and check in on your photo challenge.'),
        data: { url: '/insights' } satisfies NotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: EVENING_HOUR,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Immediate celebration when a challenge is completed. Returns false if it couldn't be shown. */
export async function notifyMilestone(title: string, reward: string) {
  if (!Notifications) return false;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('🏆 Challenge complete!'),
      body: t('{title}: you unlocked the {reward}.', { title, reward }),
      data: { url: '/insights' } satisfies NotificationData,
    },
    trigger: null,
  });
  return true;
}
