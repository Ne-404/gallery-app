/**
 * Non-destructive photo edits. Originals are never modified; edits are stored per item
 * and applied at render time with style filters, overlays, transforms and text layers.
 */
import type { TKey } from '@/lib/i18n';

export type FilterId = 'normal' | 'vivid' | 'warm' | 'cool' | 'fade' | 'noir' | 'retro' | 'drama';
export type AdjustKey =
  | 'brightness'
  | 'contrast'
  | 'highlights'
  | 'shadows'
  | 'saturation'
  | 'warmth'
  | 'tint'
  | 'fade'
  | 'hue'
  | 'vignette';

/**
 * Normalized (0–1) crop rectangle in the displayed (rotated and flipped) photo. Rotating
 * resets it; flipping mirrors it.
 */
export type CropRect = { x: number; y: number; w: number; h: number };

export type TextStyleId = 'classic' | 'strong' | 'box' | 'serif' | 'neon' | 'type';

/** A caption drawn on top of the photo. Position is its center in the cropped frame (0–1). */
export type TextLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  /** Font size as a fraction of the frame width. */
  size: number;
  color: string;
  style: TextStyleId;
};

/** A freehand line drawn on the photo, in normalized (0–1) frame coordinates. */
export type Stroke = {
  kind: 'pen' | 'marker' | 'neon';
  color: string;
  /** Line width as a fraction of the frame width. */
  width: number;
  points: [number, number][];
};

export type Edit = {
  filter: FilterId;
  /** Each adjustment ranges from -1 to 1, 0 is unchanged (fade and vignette: 0 to 1). */
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  fade: number;
  hue: number;
  vignette: number;
  highlights: number;
  shadows: number;
  tint: number;
  rotation: 0 | 90 | 180 | 270;
  /** Fine rotation in degrees (−45…45); the photo zooms just enough to keep the frame full. */
  straighten: number;
  flip: boolean;
  crop: CropRect;
  texts: TextLayer[];
  drawings: Stroke[];
};

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export const DEFAULT_EDIT: Edit = {
  filter: 'normal',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  fade: 0,
  hue: 0,
  vignette: 0,
  highlights: 0,
  shadows: 0,
  tint: 0,
  rotation: 0,
  straighten: 0,
  flip: false,
  crop: FULL_CROP,
  texts: [],
  drawings: [],
};

/** Fills in fields added after an edit was saved (older edits lack crop, texts, hue…). */
export function normalizeEdit(saved: Partial<Edit> & { aspect?: unknown }): Edit {
  const { aspect: _legacy, ...rest } = saved;
  return { ...DEFAULT_EDIT, ...rest };
}

type Preset = Partial<Record<AdjustKey, number>> & { grayscale?: number; sepia?: number };

export const Filters: { id: FilterId; label: TKey; preset: Preset }[] = [
  { id: 'normal', label: 'Normal', preset: {} },
  { id: 'vivid', label: 'Vivid', preset: { contrast: 0.2, saturation: 0.45 } },
  { id: 'warm', label: 'Golden', preset: { warmth: 0.55, saturation: 0.1, brightness: 0.05 } },
  { id: 'cool', label: 'Frost', preset: { warmth: -0.5, contrast: 0.1 } },
  { id: 'fade', label: 'Matte', preset: { fade: 0.45, contrast: -0.2, saturation: -0.15 } },
  { id: 'noir', label: 'Noir', preset: { grayscale: 1, contrast: 0.35, vignette: 0.5 } },
  { id: 'retro', label: 'Retro', preset: { sepia: 0.45, fade: 0.2, contrast: -0.05, vignette: 0.3 } },
  { id: 'drama', label: 'Drama', preset: { contrast: 0.5, saturation: -0.2, brightness: -0.08, vignette: 0.6 } },
];

export const Adjustments: { key: AdjustKey; label: TKey; min: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -1 },
  { key: 'contrast', label: 'Contrast', min: -1 },
  { key: 'highlights', label: 'Highlights', min: -1 },
  { key: 'shadows', label: 'Shadows', min: -1 },
  { key: 'saturation', label: 'Saturation', min: -1 },
  { key: 'warmth', label: 'Warmth', min: -1 },
  { key: 'tint', label: 'Tint', min: -1 },
  { key: 'hue', label: 'Hue', min: -1 },
  { key: 'fade', label: 'Fade', min: 0 },
  { key: 'vignette', label: 'Vignette', min: 0 },
];

/** Crop presets; `null` ratio is free-form, `0` keeps the photo's own shape. */
export const Aspects: { id: string; label: TKey; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: 0 },
  { id: '1:1', label: 'Square', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '9:16', label: 'Story', ratio: 9 / 16 },
  { id: '16:9', label: 'Wide', ratio: 16 / 9 },
];

export const TextColors = ['#FFFFFF', '#111111', '#FF3B5C', '#FFD23F', '#3EC6F0', '#2BB673', '#8E5CF7'];

export const TextStyles: { id: TextStyleId; label: TKey }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'strong', label: 'Strong' },
  { id: 'box', label: 'Label' },
  { id: 'serif', label: 'Serif' },
  { id: 'neon', label: 'Neon' },
  { id: 'type', label: 'Typewriter' },
];

export function isEdited(edit: Edit | undefined) {
  return !!edit && JSON.stringify(edit) !== JSON.stringify(DEFAULT_EDIT);
}

export const isTurned = (edit: Edit | undefined) => !!edit && edit.rotation % 180 !== 0;

export const isFullCrop = (c: CropRect) => c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1;

/** Adjustment values with the filter preset applied. */
function effective(edit: Edit) {
  const preset = Filters.find((f) => f.id === edit.filter)?.preset ?? {};
  const value = (key: AdjustKey) => edit[key] + (preset[key] ?? 0);
  return {
    brightness: value('brightness'),
    contrast: value('contrast'),
    saturation: value('saturation'),
    warmth: value('warmth'),
    fade: Math.min(1, value('fade')),
    hue: value('hue'),
    vignette: Math.min(1, value('vignette')),
    highlights: value('highlights'),
    shadows: value('shadows'),
    tint: value('tint'),
    grayscale: preset.grayscale ?? 0,
    sepia: preset.sepia ?? 0,
  };
}

/** CSS-style filter string, supported by React Native's `filter` style and the web. */
export function filterStyle(edit: Edit) {
  const e = effective(edit);
  const parts = [
    `brightness(${(1 + e.brightness * 0.5).toFixed(3)})`,
    `contrast(${(1 + e.contrast * 0.5).toFixed(3)})`,
    `saturate(${Math.max(0, 1 + e.saturation).toFixed(3)})`,
  ];
  if (e.hue) parts.push(`hue-rotate(${Math.round(e.hue * 180)}deg)`);
  if (e.grayscale) parts.push(`grayscale(${e.grayscale})`);
  if (e.sepia) parts.push(`sepia(${e.sepia})`);
  return parts.join(' ');
}

type BlendMode = 'normal' | 'screen' | 'multiply' | 'soft-light';

/**
 * Color washes drawn over the photo: warmth, tint and fade, plus blended greys that
 * approximate shadows (screen lifts darks most) and highlights (multiply tames brights).
 */
export function overlays(edit: Edit) {
  const e = effective(edit);
  const result: { color: string; opacity: number; blend?: BlendMode }[] = [];
  if (e.shadows > 0) result.push({ color: '#5A5A5A', opacity: e.shadows * 0.55, blend: 'screen' });
  if (e.shadows < 0) result.push({ color: '#000000', opacity: -e.shadows * 0.35, blend: 'soft-light' });
  if (e.highlights < 0) result.push({ color: '#BDBDBD', opacity: -e.highlights * 0.6, blend: 'multiply' });
  if (e.highlights > 0) result.push({ color: '#FFFFFF', opacity: e.highlights * 0.35, blend: 'soft-light' });
  if (e.tint > 0) result.push({ color: '#FF2BD6', opacity: e.tint * 0.12 });
  if (e.tint < 0) result.push({ color: '#18D860', opacity: -e.tint * 0.12 });
  if (e.warmth > 0) result.push({ color: '#FF8A00', opacity: e.warmth * 0.18 });
  if (e.warmth < 0) result.push({ color: '#0A84FF', opacity: -e.warmth * 0.16 });
  if (e.fade > 0) result.push({ color: '#FFFFFF', opacity: e.fade * 0.32 });
  return result;
}

/** Strength (0–1) of the darkened edges. */
export const vignetteOf = (edit: Edit) => effective(edit).vignette;

/** Width / height of the full photo after rotation. */
export function rotatedAspect(edit: Edit | undefined, width: number, height: number) {
  return isTurned(edit) ? height / width : width / height;
}

/** Width / height of the photo as displayed: rotated, then cropped. */
export function aspectRatio(edit: Edit | undefined, width: number, height: number) {
  const full = rotatedAspect(edit, width, height);
  return edit ? (full * edit.crop.w) / edit.crop.h : full;
}

/** The largest centered crop of a photo (aspect `photo`) with the given aspect ratio. */
export function centeredCrop(ratio: number, photo: number): CropRect {
  if (ratio < photo) {
    const w = ratio / photo;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = photo / ratio;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

export type Rect = { x: number; y: number; width: number; height: number };

/** Places content of the given aspect ratio in a box, like `contentFit`. */
export function fitRect(box: { width: number; height: number }, aspect: number, fit: 'contain' | 'cover'): Rect {
  const boxAspect = box.width / box.height;
  const widthBound = fit === 'contain' ? aspect > boxAspect : aspect < boxAspect;
  const width = widthBound ? box.width : box.height * aspect;
  const height = widthBound ? box.width / aspect : box.height;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

/** Zoom needed so a photo rotated by `degrees` still covers its whole (w × h) frame. */
export function straightenScale(degrees: number, w: number, h: number) {
  const a = (Math.abs(degrees) * Math.PI) / 180;
  if (!a || !w || !h) return 1;
  return Math.max((w * Math.cos(a) + h * Math.sin(a)) / w, (w * Math.sin(a) + h * Math.cos(a)) / h);
}

/** One-tap enhance: a gentle, generally flattering set of adjustments. */
export const AUTO_ENHANCE: Partial<Edit> = {
  brightness: 0.06,
  contrast: 0.14,
  highlights: -0.2,
  shadows: 0.25,
  saturation: 0.15,
  vignette: 0.15,
};

/** SVG path data for a stroke in a frame of the given size. */
export function strokePath(stroke: Stroke, width: number, height: number) {
  return stroke.points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * width).toFixed(1)} ${(y * height).toFixed(1)}`)
    .join(' ');
}
