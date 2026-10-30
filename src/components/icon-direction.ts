import type { AndroidSymbol } from 'expo-symbols';

/**
 * Material Symbols that point along the reading direction, so they're mirrored in Arabic.
 * (SF Symbols already flip themselves on iOS.) Media controls such as play stay as they are.
 */
const DIRECTIONAL = new Set<AndroidSymbol>([
  'arrow_back',
  'arrow_forward',
  'chevron_left',
  'chevron_right',
  'backspace',
  'undo',
  'redo',
  'open_in_new',
  'format_list_bulleted',
  'checklist',
]);

export const mirrorStyle = { transform: [{ scaleX: -1 }] };

export const isDirectional = (name: AndroidSymbol) => DIRECTIONAL.has(name);
