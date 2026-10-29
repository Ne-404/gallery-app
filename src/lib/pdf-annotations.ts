import { storage } from '@/lib/storage';

/** Pencil and marker strokes per page, kept apart from user data because they can be large. */
export type Annotations = Record<string, { tool: 'pencil' | 'marker'; color: string; points: [number, number][] }[]>;

const key = (pdfId: string) => `pdf-annotations-${pdfId}`;

/** What the reader page sends back. */
export type ReaderMessage = { type: 'ready' } | { type: 'annotations'; annotations: Annotations } | { type: 'page'; page: number };

const isPoint = (p: unknown) =>
  Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));

const isStroke = (s: unknown) => {
  const stroke = s as Annotations[string][number] | null;
  return (
    typeof stroke === 'object' &&
    stroke !== null &&
    (stroke.tool === 'pencil' || stroke.tool === 'marker') &&
    typeof stroke.color === 'string' &&
    /^#[0-9a-f]{3,8}$/i.test(stroke.color) &&
    Array.isArray(stroke.points) &&
    stroke.points.every(isPoint)
  );
};

/**
 * Parses a message from the reader page (a JSON string on device, an object on web). It
 * renders untrusted PDFs, so anything malformed is dropped instead of saved.
 */
export function parseReaderMessage(data: unknown): ReaderMessage | null {
  let msg: unknown = data;
  if (typeof data === 'string') {
    try {
      msg = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof msg !== 'object' || msg === null) return null;
  const m = msg as Record<string, unknown>;
  if (m.type === 'ready') return { type: 'ready' };
  if (m.type === 'page' && Number.isInteger(m.page) && (m.page as number) >= 1) {
    return { type: 'page', page: m.page as number };
  }
  if (m.type === 'annotations' && typeof m.annotations === 'object' && m.annotations !== null) {
    const pages = Object.entries(m.annotations);
    const valid = pages.every(([page, strokes]) => /^\d+$/.test(page) && Array.isArray(strokes) && strokes.every(isStroke));
    return valid ? { type: 'annotations', annotations: m.annotations as Annotations } : null;
  }
  return null;
}

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
