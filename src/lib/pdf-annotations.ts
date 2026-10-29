import { storage } from '@/lib/storage';

/** Pencil and marker strokes per page, kept apart from user data because they can be large. */
export type Annotations = Record<string, { tool: 'pencil' | 'marker'; color: string; points: [number, number][] }[]>;

const key = (pdfId: string) => `pdf-annotations-${pdfId}`;

export function loadAnnotations(pdfId: string): Annotations {
  try {
    return JSON.parse(storage.getItem(key(pdfId)) ?? '{}');
  } catch {
    return {};
  }
}

export function saveAnnotations(pdfId: string, annotations: Annotations) {
  try {
    storage.setItem(key(pdfId), JSON.stringify(annotations));
  } catch {
    // Storage full or unavailable; the drawing stays on screen for this session.
  }
}
