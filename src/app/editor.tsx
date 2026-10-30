import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawingLayer, EditedImage, TextLayerView, textPosition } from '@/components/edited-image';
import { Icon } from '@/components/icon';
import { Slider } from '@/components/slider';
import { TextPrompt } from '@/components/text-prompt';
import { Spacing } from '@/constants/theme';
import { useAccent, useGallery } from '@/hooks/use-gallery';
import { dirProps, dirStyle } from '@/lib/direction';
import {
  Adjustments,
  aspectRatio,
  Aspects,
  centeredCrop,
  DEFAULT_EDIT,
  Filters,
  fitRect,
  FULL_CROP,
  isEdited,
  rotatedAspect,
  TextColors,
  TextStyles,
  type AdjustKey,
  type CropRect,
  type Edit,
  type Rect,
  type Stroke,
  type TextLayer,
  AUTO_ENHANCE,
} from '@/lib/edits';
import { useT, type TKey } from '@/lib/i18n';
import { COPY_MARK, copyItem, setEdit } from '@/lib/user-data';
import { showToast } from '@/lib/toast';
import { useVaultUnlocked } from '@/lib/vault';

type Tool = 'filters' | 'adjust' | 'crop' | 'draw' | 'text';

const TOOLS: {
  id: Tool;
  label: TKey;
  ios: 'camera.filters' | 'slider.horizontal.3' | 'crop.rotate' | 'pencil.tip' | 'textformat';
  android: 'filter_vintage' | 'tune' | 'crop' | 'draw' | 'title';
}[] = [
  { id: 'filters', label: 'Filter', ios: 'camera.filters', android: 'filter_vintage' },
  { id: 'adjust', label: 'Adjust', ios: 'slider.horizontal.3', android: 'tune' },
  { id: 'crop', label: 'Crop', ios: 'crop.rotate', android: 'crop' },
  { id: 'draw', label: 'Draw', ios: 'pencil.tip', android: 'draw' },
  { id: 'text', label: 'Text', ios: 'textformat', android: 'title' },
];

const BRUSHES: { id: Stroke['kind']; label: TKey }[] = [
  { id: 'pen', label: 'Pen' },
  { id: 'marker', label: 'Marker' },
  { id: 'neon', label: 'Neon' },
];

/**
 * Non-destructive photo editor: filters, adjustments, crop/straighten/rotate/flip, drawing
 * and text. "Save copy" stores the result as a new copy; the original is left untouched.
 */
export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { itemsById, data, isVaulted } = useGallery();
  const vaultUnlocked = useVaultUnlocked();
  const accent = useAccent();
  const t = useT();
  const item = itemsById.get(id);
  const [draft, setDraft] = useState<Edit>(() => data.edits[id] ?? DEFAULT_EDIT);
  const [tool, setTool] = useState<Tool>('filters');
  const [adjusting, setAdjusting] = useState<AdjustKey>('brightness');
  const [aspectId, setAspectId] = useState('free');
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ layerId: string | null } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [brush, setBrush] = useState<Omit<Stroke, 'points'>>({ kind: 'pen', color: '#FF3B5C', width: 0.012 });

  if (!item) return <View style={styles.container} />;
  if (isVaulted(item.id) && !vaultUnlocked) return <Redirect href="/vault" />;

  const update = (patch: Partial<Edit>) => setDraft((d) => ({ ...d, ...patch }));
  const updateText = (layerId: string, patch: Partial<TextLayer>) =>
    setDraft((d) => ({ ...d, texts: d.texts.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)) }));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Editing an original saves a new edited copy next to it; editing a copy updates it.
  const isCopy = item.id.includes(COPY_MARK);
  const save = () => {
    if (isCopy) setEdit(item.id, draft);
    else if (isEdited(draft)) {
      setEdit(copyItem(item.id), draft);
      showToast(t('Saved as a new copy. The original is unchanged.'));
    }
    close();
  };

  const sourceAspect = item.width / item.height;
  const fullAspect = rotatedAspect(draft, item.width, item.height);
  // While cropping the whole photo is shown with the crop box on top; while adding text the
  // captions are drawn by the editor so they can be dragged.
  const preview: Edit | undefined = comparing
    ? undefined
    : tool === 'crop'
      ? { ...draft, crop: FULL_CROP, texts: [], drawings: [] }
      : tool === 'text'
        ? { ...draft, texts: [] }
        : draft;
  const ready = area.width > 0 && area.height > 0;
  const frame = ready ? fitRect(area, aspectRatio(preview, item.width, item.height), 'contain') : null;

  const lockedRatio = (presetId: string) => {
    const ratio = Aspects.find((a) => a.id === presetId)?.ratio;
    return ratio === 0 ? fullAspect : (ratio ?? null);
  };

  const rotate = () => {
    update({ rotation: ((draft.rotation + 90) % 360) as Edit['rotation'], crop: FULL_CROP });
    setAspectId('free');
  };
  const flip = () => update({ flip: !draft.flip, crop: { ...draft.crop, x: 1 - draft.crop.x - draft.crop.w } });

  const addText = (text: string) => {
    const layer: TextLayer = {
      id: String(Date.now()),
      text: text.trim(),
      x: 0.5,
      y: 0.5,
      size: 0.09,
      color: '#FFFFFF',
      style: 'strong',
    };
    update({ texts: [...draft.texts, layer] });
    setSelectedText(layer.id);
  };
  const selected = draft.texts.find((layer) => layer.id === selectedText);
  const adjustment = Adjustments.find((a) => a.key === adjusting)!;
  const interactive = tool === 'crop' || tool === 'text' || tool === 'draw';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable onPress={close} hitSlop={8} style={styles.topButton}>
          <Text style={styles.topText}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('Edit')}</Text>
        <Pressable onPress={save} hitSlop={8} style={styles.topButton} accessibilityLabel={isCopy ? t('Save') : t('Save copy')}>
          <Text style={[styles.topText, styles.bold, styles.right, { color: accent }]}>
            {isCopy ? t('Save') : t('Save copy')}
          </Text>
        </Pressable>
      </SafeAreaView>

      <Pressable
        style={styles.previewArea}
        disabled={interactive}
        onPressIn={() => setComparing(true)}
        onPressOut={() => setComparing(false)}>
        <View
          {...dirProps('ltr')}
          style={[styles.previewFit, dirStyle('ltr')]}
          onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
          {frame && (
            <View style={[styles.preview, { left: frame.x, top: frame.y, width: frame.width, height: frame.height }]}>
              <EditedImage
                uri={item.uri}
                placeholderUri={item.thumbUri}
                edit={preview}
                sourceAspect={sourceAspect}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
                transition={0}
              />
              {tool === 'crop' && (
                <CropOverlay
                  crop={draft.crop}
                  frame={frame}
                  ratio={lockedRatio(aspectId)}
                  onChange={(crop) => update({ crop })}
                />
              )}
              {tool === 'draw' && (
                <DrawCanvas
                  frame={frame}
                  brush={brush}
                  onStroke={(stroke) => update({ drawings: [...draft.drawings, stroke] })}
                />
              )}
              {tool === 'text' && (
                // Tapping the photo itself (not a caption) clears the selection.
                <View
                  style={StyleSheet.absoluteFill}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={() => setSelectedText(null)}
                />
              )}
              {tool === 'text' &&
                draft.texts.map((layer) => (
                  <DraggableText
                    key={layer.id}
                    layer={layer}
                    frame={frame}
                    selected={layer.id === selectedText}
                    onSelect={() => setSelectedText(layer.id)}
                    onEdit={() => setPrompt({ layerId: layer.id })}
                    onMove={(x, y) => updateText(layer.id, { x, y })}
                  />
                ))}
            </View>
          )}
        </View>
        <Text style={styles.hint}>
          {tool === 'crop'
            ? t('Drag the corners to crop, or drag inside to move')
            : tool === 'text'
              ? draft.texts.length
                ? t('Drag text to move it · tap selected text to edit')
                : t('Add a caption to your photo')
              : comparing
                ? t('Original')
                : t('Hold to compare')}
        </Text>
      </Pressable>

      <SafeAreaView edges={['bottom']} style={styles.panel}>
        {tool === 'filters' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {Filters.map((f) => {
              const isSelected = draft.filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    update({ filter: f.id });
                  }}
                  style={styles.filter}>
                  <Text style={[styles.filterLabel, isSelected && { color: accent }]}>{t(f.label)}</Text>
                  <EditedImage
                    uri={item.thumbUri}
                    edit={{ ...DEFAULT_EDIT, filter: f.id }}
                    style={[styles.filterThumb, isSelected && { borderColor: accent }]}
                    transition={0}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {tool === 'adjust' && (
          <View style={styles.tool}>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t(adjustment.label)}</Text>
              <Text style={styles.sliderValue}>{Math.round(draft[adjusting] * 100)}</Text>
              <Pressable
                onPress={() => {
                  update(AUTO_ENHANCE);
                }}
                accessibilityLabel={t('Auto enhance')}
                style={[styles.auto, { borderColor: accent }]}>
                <Icon ios="wand.and.stars" android="auto_fix_high" size={14} color={accent} />
                <Text style={[styles.chipText, { color: accent }]}>{t('Auto')}</Text>
              </Pressable>
            </View>
            <Slider
              value={draft[adjusting]}
              min={adjustment.min}
              max={1}
              color={accent}
              onChange={(v) => update({ [adjusting]: v })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {Adjustments.map((a) => (
                <Chip
                  key={a.key}
                  label={`${t(a.label)}${draft[a.key] !== 0 ? ' •' : ''}`}
                  selected={a.key === adjusting}
                  color={accent}
                  onPress={() => setAdjusting(a.key)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {tool === 'crop' && (
          <View style={styles.tool}>
            <View style={styles.row}>
              <ToolButton label={t('Rotate')} onPress={rotate}>
                <Icon ios="rotate.right" android="rotate_right" color="#fff" />
              </ToolButton>
              <ToolButton label={t('Flip')} onPress={flip}>
                <Icon ios="arrow.left.and.right.righttriangle.left.righttriangle.right" android="flip" color="#fff" />
              </ToolButton>
              <ToolButton
                label={t('Reset')}
                onPress={() => {
                  update({ crop: FULL_CROP });
                  setAspectId('free');
                }}>
                <Icon ios="arrow.counterclockwise" android="restart_alt" color="#fff" />
              </ToolButton>
            </View>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t('Straighten')}</Text>
              <Text style={styles.sliderValue}>{Math.round(draft.straighten)}°</Text>
            </View>
            <Slider
              value={draft.straighten}
              min={-45}
              max={45}
              color={accent}
              onChange={(v) => update({ straighten: Math.round(v * 2) / 2 })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {Aspects.map((a) => (
                <Chip
                  key={a.id}
                  label={t(a.label)}
                  selected={aspectId === a.id}
                  color={accent}
                  onPress={() => {
                    setAspectId(a.id);
                    const ratio = lockedRatio(a.id);
                    if (ratio) update({ crop: centeredCrop(ratio, fullAspect) });
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {tool === 'draw' && (
          <View style={styles.tool}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {BRUSHES.map((b) => (
                <Chip
                  key={b.id}
                  label={t(b.label)}
                  selected={brush.kind === b.id}
                  color={accent}
                  onPress={() => setBrush((x) => ({ ...x, kind: b.id }))}
                />
              ))}
              {TextColors.map((color) => (
                <Pressable
                  key={color}
                  accessibilityLabel={t('Brush color {color}', { color })}
                  onPress={() => {
                    setBrush((x) => ({ ...x, color }));
                  }}
                  style={[
                    styles.color,
                    { backgroundColor: color },
                    brush.color === color && { borderColor: accent, transform: [{ scale: 1.15 }] },
                  ]}
                />
              ))}
            </ScrollView>
            <View style={styles.sizeRow}>
              <Icon ios="circle.fill" android="circle" size={8} color="#aaa" />
              <View style={styles.flex}>
                <Slider
                  value={brush.width}
                  min={0.004}
                  max={0.04}
                  color={accent}
                  onChange={(width) => setBrush((x) => ({ ...x, width: Math.max(0.004, width) }))}
                />
              </View>
              <Icon ios="circle.fill" android="circle" size={18} color="#aaa" />
            </View>
            <View style={styles.row}>
              <ToolButton label={t('Undo')} onPress={() => update({ drawings: draft.drawings.slice(0, -1) })}>
                <Icon ios="arrow.uturn.backward" android="undo" color="#fff" />
              </ToolButton>
              <ToolButton label={t('Clear')} onPress={() => update({ drawings: [] })}>
                <Icon ios="trash" android="delete" color="#fff" />
              </ToolButton>
            </View>
          </View>
        )}

        {tool === 'text' && (
          <View style={styles.tool}>
            {selected ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {TextColors.map((color) => (
                    <Pressable
                      key={color}
                      accessibilityLabel={t('Text color {color}', { color })}
                      onPress={() => {
                        updateText(selected.id, { color });
                      }}
                      style={[
                        styles.color,
                        { backgroundColor: color },
                        selected.color === color && { borderColor: accent, transform: [{ scale: 1.15 }] },
                      ]}
                    />
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {TextStyles.map((style) => (
                    <Chip
                      key={style.id}
                      label={t(style.label)}
                      selected={selected.style === style.id}
                      color={accent}
                      onPress={() => updateText(selected.id, { style: style.id })}
                    />
                  ))}
                </ScrollView>
                <View style={styles.sizeRow}>
                  <Icon ios="textformat.size.smaller" android="text_decrease" size={18} color="#aaa" />
                  <View style={styles.flex}>
                    <Slider
                      value={selected.size}
                      min={0.03}
                      max={0.22}
                      color={accent}
                      onChange={(size) => updateText(selected.id, { size })}
                    />
                  </View>
                  <Icon ios="textformat.size.larger" android="text_increase" size={18} color="#aaa" />
                </View>
                <View style={styles.row}>
                  <ToolButton label={t('Edit')} onPress={() => setPrompt({ layerId: selected.id })}>
                    <Icon ios="pencil" android="edit" color="#fff" />
                  </ToolButton>
                  <ToolButton label={t('Add')} onPress={() => setPrompt({ layerId: null })}>
                    <Icon ios="plus" android="add" color="#fff" />
                  </ToolButton>
                  <ToolButton
                    label={t('Delete')}
                    onPress={() => {
                      update({ texts: draft.texts.filter((layer) => layer.id !== selected.id) });
                      setSelectedText(null);
                    }}>
                    <Icon ios="trash" android="delete" color="#FF6B6B" />
                  </ToolButton>
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => setPrompt({ layerId: null })}
                accessibilityLabel={t('Add text')}
                style={({ pressed }) => [styles.addText, { backgroundColor: accent }, pressed && styles.pressed]}>
                <Icon ios="textformat" android="title" color="#fff" />
                <Text style={[styles.chipText, styles.bold]}>{t('Add text')}</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.tools}>
          {TOOLS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityLabel={t('{name} tool', { name: t(option.label) })}
              onPress={() => {
                setTool(option.id);
              }}
              style={styles.toolTab}>
              <Icon ios={option.ios} android={option.android} size={22} color={tool === option.id ? accent : '#aaa'} />
              <Text style={[styles.toolLabel, tool === option.id && { color: accent }]}>{t(option.label)}</Text>
            </Pressable>
          ))}
          {isEdited(draft) && (
            <Pressable
              onPress={() => {
                setDraft(DEFAULT_EDIT);
                setAspectId('free');
                setSelectedText(null);
              }}
              style={styles.toolTab}>
              <Icon ios="arrow.uturn.backward" android="undo" size={22} color="#aaa" />
              <Text style={styles.toolLabel}>{t('Reset')}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <TextPrompt
        visible={prompt !== null}
        title={prompt?.layerId ? t('Edit text') : t('Add text')}
        placeholder={t('Say something about this moment')}
        initialValue={draft.texts.find((layer) => layer.id === prompt?.layerId)?.text}
        submitLabel={prompt?.layerId ? t('Update') : t('Add')}
        onClose={() => setPrompt(null)}
        onSubmit={(text) => {
          const layerId = prompt?.layerId;
          if (!layerId) {
            if (text.trim()) addText(text);
          } else if (text.trim()) {
            updateText(layerId, { text: text.trim() });
          } else {
            update({ texts: draft.texts.filter((layer) => layer.id !== layerId) });
            setSelectedText(null);
          }
        }}
      />
    </View>
  );
}

/** Pointer position relative to a view, measured when a drag starts (like the slider). */
function useDragOrigin() {
  const view = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const measure = (then: () => void) => {
    origin.current = null;
    view.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
      then();
    });
  };
  const local = (e: GestureResponderEvent) =>
    origin.current && { x: e.nativeEvent.pageX - origin.current.x, y: e.nativeEvent.pageY - origin.current.y };
  return { view, measure, local };
}

/** Freehand drawing surface over the preview; shows the stroke in progress. */
function DrawCanvas({
  frame,
  brush,
  onStroke,
}: {
  frame: Rect;
  brush: Omit<Stroke, 'points'>;
  onStroke: (stroke: Stroke) => void;
}) {
  const { view, measure, local } = useDragOrigin();
  const [points, setPoints] = useState<[number, number][]>([]);
  const point = (e: GestureResponderEvent): [number, number] | null => {
    const p = local(e);
    return p && [Math.round((p.x / frame.width) * 10000) / 10000, Math.round((p.y / frame.height) * 10000) / 10000];
  };

  return (
    <View
      ref={view}
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const { pageX, pageY } = e.nativeEvent;
        measure(() => {
          const p = point({ nativeEvent: { pageX, pageY } } as GestureResponderEvent);
          if (p) setPoints([p]);
        });
      }}
      onResponderMove={(e) => {
        const p = point(e);
        if (p) setPoints((pts) => [...pts, p]);
      }}
      onResponderRelease={() => {
        if (points.length > 0) onStroke({ ...brush, points });
        setPoints([]);
      }}>
      <DrawingLayer strokes={points.length ? [{ ...brush, points }] : []} width={frame.width} height={frame.height} />
    </View>
  );
}

const HANDLE_REACH = 36;
const MIN_CROP = 48;

/** Crop box with draggable corners (free or locked ratio); dragging inside moves it. */
function CropOverlay({
  crop,
  frame,
  ratio,
  onChange,
}: {
  crop: CropRect;
  frame: Rect;
  ratio: number | null;
  onChange: (crop: CropRect) => void;
}) {
  const { view, measure, local } = useDragOrigin();
  const W = frame.width;
  const H = frame.height;
  const box = { left: crop.x * W, top: crop.y * H, width: crop.w * W, height: crop.h * H };
  const drag = useRef<
    | { kind: 'corner'; ax: number; ay: number; sx: number; sy: number }
    | { kind: 'move'; px: number; py: number; left: number; top: number }
    | null
  >(null);

  const emit = (left: number, top: number, width: number, height: number) => {
    const round = (v: number) => Math.round(v * 10000) / 10000;
    onChange({ x: round(left / W), y: round(top / H), w: round(width / W), h: round(height / H) });
  };

  const start = (pageX: number, pageY: number) => {
    const p = local({ nativeEvent: { pageX, pageY } } as GestureResponderEvent);
    if (!p) return;
    const corners = [
      { x: box.left, y: box.top, sx: -1, sy: -1 },
      { x: box.left + box.width, y: box.top, sx: 1, sy: -1 },
      { x: box.left, y: box.top + box.height, sx: -1, sy: 1 },
      { x: box.left + box.width, y: box.top + box.height, sx: 1, sy: 1 },
    ];
    const corner = corners.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < HANDLE_REACH);
    if (corner) {
      // The opposite corner stays put while this one follows the finger.
      drag.current = {
        kind: 'corner',
        ax: corner.sx > 0 ? box.left : box.left + box.width,
        ay: corner.sy > 0 ? box.top : box.top + box.height,
        sx: corner.sx,
        sy: corner.sy,
      };
    } else if (p.x > box.left && p.x < box.left + box.width && p.y > box.top && p.y < box.top + box.height) {
      drag.current = { kind: 'move', px: p.x, py: p.y, left: box.left, top: box.top };
    } else {
      drag.current = null;
    }
  };

  const move = (e: GestureResponderEvent) => {
    const p = local(e);
    const d = drag.current;
    if (!p || !d) return;
    if (d.kind === 'move') {
      const left = Math.min(Math.max(d.left + p.x - d.px, 0), W - box.width);
      const top = Math.min(Math.max(d.top + p.y - d.py, 0), H - box.height);
      emit(left, top, box.width, box.height);
      return;
    }
    const maxW = d.sx > 0 ? W - d.ax : d.ax;
    const maxH = d.sy > 0 ? H - d.ay : d.ay;
    let width = Math.min(maxW, Math.max(MIN_CROP, (p.x - d.ax) * d.sx));
    let height = Math.min(maxH, Math.max(MIN_CROP, (p.y - d.ay) * d.sy));
    if (ratio) {
      if (width / height > ratio) width = height * ratio;
      else height = width / ratio;
    }
    emit(d.sx > 0 ? d.ax : d.ax - width, d.sy > 0 ? d.ay : d.ay - height, width, height);
  };

  const shade = 'rgba(0,0,0,0.6)';
  return (
    <View
      ref={view}
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const { pageX, pageY } = e.nativeEvent;
        measure(() => start(pageX, pageY));
      }}
      onResponderMove={move}
      onResponderRelease={() => {
        drag.current = null;
      }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.shade, { backgroundColor: shade, left: 0, right: 0, top: 0, height: box.top }]} />
        <View
          style={[styles.shade, { backgroundColor: shade, left: 0, right: 0, top: box.top + box.height, bottom: 0 }]}
        />
        <View style={[styles.shade, { backgroundColor: shade, left: 0, width: box.left, top: box.top, height: box.height }]} />
        <View
          style={[
            styles.shade,
            { backgroundColor: shade, left: box.left + box.width, right: 0, top: box.top, height: box.height },
          ]}
        />
        <View style={[styles.cropBox, box]}>
          {[1, 2].map((i) => (
            <View key={`v${i}`} style={[styles.gridLine, { left: `${(i * 100) / 3}%`, top: 0, bottom: 0, width: 1 }]} />
          ))}
          {[1, 2].map((i) => (
            <View key={`h${i}`} style={[styles.gridLine, { top: `${(i * 100) / 3}%`, left: 0, right: 0, height: 1 }]} />
          ))}
          <View style={[styles.corner, { left: -3, top: -3, borderLeftWidth: 4, borderTopWidth: 4 }]} />
          <View style={[styles.corner, { right: -3, top: -3, borderRightWidth: 4, borderTopWidth: 4 }]} />
          <View style={[styles.corner, { left: -3, bottom: -3, borderLeftWidth: 4, borderBottomWidth: 4 }]} />
          <View style={[styles.corner, { right: -3, bottom: -3, borderRightWidth: 4, borderBottomWidth: 4 }]} />
        </View>
      </View>
    </View>
  );
}

/** A caption on the preview: drag to move, tap when selected to edit. */
function DraggableText({
  layer,
  frame,
  selected,
  onSelect,
  onEdit,
  onMove,
}: {
  layer: TextLayer;
  frame: Rect;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const start = useRef({ pageX: 0, pageY: 0, x: 0, y: 0, moved: false, wasSelected: false });
  const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v));

  return (
    <View
      accessibilityLabel={`Caption: ${layer.text}`}
      style={[textPosition(layer, frame), styles.caption, selected && styles.captionSelected]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        start.current = {
          pageX: e.nativeEvent.pageX,
          pageY: e.nativeEvent.pageY,
          x: layer.x,
          y: layer.y,
          moved: false,
          wasSelected: selected,
        };
        onSelect();
      }}
      onResponderMove={(e) => {
        const s = start.current;
        const dx = e.nativeEvent.pageX - s.pageX;
        const dy = e.nativeEvent.pageY - s.pageY;
        if (Math.hypot(dx, dy) > 4) s.moved = true;
        onMove(clamp(s.x + dx / frame.width), clamp(s.y + dy / frame.height));
      }}
      onResponderRelease={() => {
        if (!start.current.moved && start.current.wasSelected) onEdit();
      }}>
      <TextLayerView layer={layer} frameWidth={frame.width} />
    </View>
  );
}

function Chip({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        onPress();
      }}
      style={[styles.chip, selected && { backgroundColor: color }]}>
      <Text style={[styles.chipText, selected && styles.bold]}>{label}</Text>
    </Pressable>
  );
}

function ToolButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => {
        onPress();
      }}
      style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}>
      {children}
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  topButton: {
    paddingVertical: Spacing.three,
    minWidth: 60,
  },
  topText: {
    color: '#fff',
    fontSize: 16,
  },
  right: {
    textAlign: 'right',
  },
  bold: {
    fontWeight: 700,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 700,
  },
  previewArea: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  // Crop handles, strokes and captions are placed in photo coordinates, so this stays
  // left-to-right even in Arabic.
  previewFit: {
    flex: 1,
  },
  preview: {
    position: 'absolute',
  },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
  },
  shade: {
    position: 'absolute',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#fff',
  },
  caption: {
    padding: Spacing.one,
    borderRadius: Spacing.one,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  captionSelected: {
    borderColor: 'rgba(255,255,255,0.9)',
  },
  panel: {
    backgroundColor: '#111',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  filters: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  filter: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  filterLabel: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: 600,
  },
  filterThumb: {
    width: 72,
    height: 72,
    borderRadius: Spacing.two,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tool: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  auto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: 'auto',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  sliderLabel: {
    color: '#fff',
    fontWeight: 600,
  },
  sliderValue: {
    color: '#aaa',
    fontVariant: ['tabular-nums'],
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    backgroundColor: '#262626',
  },
  chipText: {
    color: '#fff',
    fontSize: 13,
  },
  color: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: '#444',
    margin: 2,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toolButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 44,
    borderRadius: Spacing.three,
    backgroundColor: '#262626',
  },
  addText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 48,
    borderRadius: 24,
  },
  pressed: {
    opacity: 0.6,
  },
  tools: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    paddingVertical: Spacing.two,
  },
  toolTab: {
    alignItems: 'center',
    gap: Spacing.half,
    minWidth: 56,
  },
  toolLabel: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: 600,
  },
});
