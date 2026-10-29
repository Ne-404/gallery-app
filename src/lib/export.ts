import { createStore } from '@/lib/create-store';
import type { Edit } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';

/**
 * Turns an edited photo into a real image file for sharing. Edits are only applied at
 * render time, so `ExportHost` (mounted in the root layout) draws the photo off-screen and
 * captures it. Requests run one at a time.
 */
export type ExportRequest = { item: MediaItem; edit: Edit; resolve: (uri: string | null) => void };

const request = createStore<ExportRequest | null>(null);
export const useExportRequest = request.use;

let queue: Promise<unknown> = Promise.resolve();

export function renderEdited(item: MediaItem, edit: Edit): Promise<string | null> {
  const run = () => new Promise<string | null>((resolve) => request.set({ item, edit, resolve }));
  const result = queue.then(run, run);
  queue = result;
  return result;
}

export function finishExport(uri: string | null) {
  const current = request.get();
  request.set(null);
  current?.resolve(uri);
}
