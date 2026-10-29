import type { JournalNote, NoteColor, UserData } from '@/lib/user-data';

/** Card tints, applied over the theme background so they work in light and dark themes. */
export const NOTE_COLORS: Record<NoteColor, string | null> = {
  none: null,
  yellow: '#FFD23F',
  green: '#2BB673',
  blue: '#3C87F7',
  pink: '#FF5C8A',
  purple: '#8E5CF7',
};

/** One entry in the Notes list: a freestanding note or a note written on a photo. */
export type NoteEntry =
  | { kind: 'journal'; id: string; note: JournalNote; title: string; body: string; updatedAt: number; pinned: boolean }
  | { kind: 'photo'; id: string; itemId: string; title: string; body: string; updatedAt: number; pinned: false };

export function noteEntries(data: UserData): NoteEntry[] {
  const journal = data.journal.map(
    (note): NoteEntry => ({
      kind: 'journal',
      id: note.id,
      note,
      title: note.title || firstLine(note.body) || 'New note',
      body: note.title ? note.body : note.body.split('\n').slice(1).join('\n'),
      updatedAt: note.updatedAt,
      pinned: note.pinned,
    })
  );
  const photos = Object.entries(data.notes).map(
    ([itemId, note]): NoteEntry => ({
      kind: 'photo',
      id: `photo:${itemId}`,
      itemId,
      title: data.titles[itemId] ?? 'Photo note',
      body: note.text,
      updatedAt: note.updatedAt,
      pinned: false,
    })
  );
  return [...journal, ...photos].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

const firstLine = (text: string) => text.split('\n')[0].replace(/^(☐|☑|•|#) /, '').trim();

export type Line =
  | { type: 'check'; done: boolean; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string };

export function parseLines(body: string): Line[] {
  return body.split('\n').map((line): Line => {
    if (line.startsWith('☐ ') || line.startsWith('☑ ')) return { type: 'check', done: line[0] === '☑', text: line.slice(2) };
    if (line.startsWith('• ')) return { type: 'bullet', text: line.slice(2) };
    if (line.startsWith('# ')) return { type: 'heading', text: line.slice(2) };
    return { type: 'text', text: line };
  });
}

/** Ticks or unticks checklist line `index`. */
export function toggleLine(body: string, index: number) {
  const lines = body.split('\n');
  const line = lines[index];
  lines[index] = line.startsWith('☑ ') ? `☐ ${line.slice(2)}` : `☑ ${line.slice(2)}`;
  return lines.join('\n');
}

const PREFIXES = ['☐ ', '☑ ', '• '];

/**
 * Notes-app list behavior: pressing Enter on a checklist or bullet line starts another one,
 * and Enter on an empty item ends the list.
 */
export function continueList(previous: string, next: string) {
  if (next.length !== previous.length + 1) return next;
  let at = 0;
  while (at < previous.length && previous[at] === next[at]) at++;
  if (next[at] !== '\n') return next;
  const lineStart = previous.lastIndexOf('\n', at - 1) + 1;
  const line = previous.slice(lineStart, at);
  const prefix = PREFIXES.find((p) => line.startsWith(p));
  if (!prefix) return next;
  if (line.length === prefix.length) return previous.slice(0, lineStart) + previous.slice(at);
  const carried = prefix === '☑ ' ? '☐ ' : prefix;
  return next.slice(0, at + 1) + carried + next.slice(at + 1);
}

/** Inserts a line prefix (checklist, bullet, heading) at the start of the cursor's line. */
export function prefixLine(body: string, cursor: number, prefix: string) {
  const lineStart = body.lastIndexOf('\n', cursor - 1) + 1;
  const line = body.slice(lineStart);
  const existing = ['☐ ', '☑ ', '• ', '# '].find((p) => line.startsWith(p));
  if (existing === prefix) return body.slice(0, lineStart) + body.slice(lineStart + prefix.length);
  const rest = existing ? body.slice(lineStart + existing.length) : body.slice(lineStart);
  return body.slice(0, lineStart) + prefix + rest;
}
