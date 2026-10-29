import { createStore } from '@/lib/create-store';

/** A short confirmation at the bottom of the screen, optionally with an action (Undo). */
export type Toast = { id: number; message: string; action?: { label: string; onPress: () => void } };

const toast = createStore<Toast | null>(null);
export const useToast = toast.use;

let timer = 0;

export function showToast(message: string, action?: Toast['action']) {
  clearTimeout(timer);
  const id = Date.now();
  toast.set({ id, message, action });
  timer = Number(setTimeout(() => toast.set((t) => (t?.id === id ? null : t)), action ? 5000 : 2600));
}

export function hideToast() {
  clearTimeout(timer);
  toast.set(null);
}
