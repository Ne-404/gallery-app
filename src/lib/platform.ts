import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Expo Go on Android lacks some native modules (full media library access, and the
 * push-topic module that `expo-notifications` loads on import).
 */
export const isAndroidExpoGo =
  Platform.OS === 'android' &&
  (Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === 'expo');
