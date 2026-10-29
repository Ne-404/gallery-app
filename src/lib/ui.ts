import { Alert, Platform } from 'react-native';

/** Side panel open/close, driven by state owned by the root layout. */
let setPanelOpen: ((open: boolean) => void) | null = null;

export function registerSidePanel(setter: ((open: boolean) => void) | null) {
  setPanelOpen = setter;
}

export const openSidePanel = () => setPanelOpen?.(true);
export const closeSidePanel = () => setPanelOpen?.(false);

/** A destructive yes/no prompt. React Native Web's `Alert` is a no-op, so web uses `confirm`. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Horizontal controls (sliders) block the tab swipe while they're being dragged, and for a
 * moment after, since the swipe gesture ends just after the drag does.
 */
let swipeBlockedUntil = 0;
export const blockSwipe = (ms = 400) => {
  swipeBlockedUntil = Date.now() + ms;
};
export const isSwipeBlocked = () => Date.now() < swipeBlockedUntil;
