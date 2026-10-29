import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import Svg, { G, Path } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import {
  aspectRatio,
  filterStyle,
  fitRect,
  isFullCrop,
  isTurned,
  overlays,
  straightenScale,
  strokePath,
  vignetteOf,
  type Edit,
  type Rect,
  type Stroke,
  type TextLayer,
} from '@/lib/edits';

type EditedImageProps = {
  uri: string;
  placeholderUri?: string;
  edit?: Edit;
  /** The photo's own width / height. Needed to lay out crops and captions exactly. */
  sourceAspect?: number;
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  recyclingKey?: string;
  transition?: number;
  /** Loading priority; the viewer raises it for the photo on screen. */
  priority?: ImageProps['priority'];
  /** Called once the full image has loaded (used when exporting an edited copy). */
  onLoad?: () => void;
};

/** Renders a photo with its saved (non-destructive) edits applied. */
export function EditedImage({
  uri,
  placeholderUri,
  edit,
  sourceAspect = 1,
  contentFit = 'cover',
  style,
  recyclingKey,
  transition = 150,
  priority,
  onLoad,
}: EditedImageProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  // Crops, quarter turns and captions need the exact on-screen photo rectangle; plain
  // filters can simply fill the container.
  const precise =
    !!edit &&
    (isTurned(edit) ||
      !isFullCrop(edit.crop) ||
      edit.texts.length > 0 ||
      edit.drawings.length > 0 ||
      edit.straighten !== 0);

  const image = (
    <Image
      source={{ uri }}
      placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
      // The cached thumbnail fills the frame at once instead of sitting small in the middle.
      placeholderContentFit={contentFit === 'contain' ? 'contain' : 'cover'}
      priority={priority}
      cachePolicy="memory-disk"
      style={StyleSheet.absoluteFill}
      contentFit={precise ? 'fill' : contentFit}
      transition={transition}
      recyclingKey={recyclingKey}
      onLoad={onLoad}
    />
  );

  // `frame` is the visible (cropped) photo inside the container.
  const frame =
    edit && precise && box.width > 0 && box.height > 0
      ? fitRect(box, aspectRatio(edit, sourceAspect, 1), contentFit === 'contain' ? 'contain' : 'cover')
      : null;

  return (
    // Only crops and captions need measuring (plain photos skip the extra render). The key
    // remounts the view when that changes, since react-native-web only wires `onLayout` up
    // on mount.
    <View
      key={precise ? 'measured' : 'plain'}
      style={[styles.container, style]}
      onLayout={
        precise
          ? (e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
          : undefined
      }>
      {!precise && (
        <>
          <View style={[StyleSheet.absoluteFill, edit && photoTransform(edit)]}>{image}</View>
          {edit && <Finish edit={edit} />}
        </>
      )}
      {edit && frame && (
        <View style={[styles.frame, { left: frame.x, top: frame.y, width: frame.width, height: frame.height }]}>
          <RotatedPhoto edit={edit} frame={frame}>
            {image}
          </RotatedPhoto>
          <Finish edit={edit} />
          <DrawingLayer strokes={edit.drawings} width={frame.width} height={frame.height} />
          {edit.texts.map((layer) => (
            <View key={layer.id} pointerEvents="none" style={textPosition(layer, frame)}>
              <TextLayerView layer={layer} frameWidth={frame.width} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** The whole photo, rotated and flipped, positioned so the crop shows through `frame`. */
export function RotatedPhoto({ edit, frame, children }: { edit: Edit; frame: Rect; children: React.ReactNode }) {
  const { crop } = edit;
  const full = { width: frame.width / crop.w, height: frame.height / crop.h };
  // A quarter turn swaps width and height, so the photo is laid out in a swapped box
  // centered on the full rectangle before rotating.
  const turned = isTurned(edit);
  const inner = turned
    ? {
        width: full.height,
        height: full.width,
        left: (full.width - full.height) / 2,
        top: (full.height - full.width) / 2,
      }
    : { width: full.width, height: full.height, left: 0, top: 0 };

  return (
    <View
      style={{
        position: 'absolute',
        left: -crop.x * full.width,
        top: -crop.y * full.height,
        width: full.width,
        height: full.height,
      }}>
      <View
        style={[
          styles.frame,
          inner,
          photoTransform(edit, straightenScale(edit.straighten, full.width, full.height)),
        ]}>
        {children}
      </View>
    </View>
  );
}

function photoTransform(edit: Edit, zoom = 1): ViewStyle {
  return {
    filter: filterStyle(edit),
    // Mirror after rotating, so "flip" is always left-right on screen. Straightening adds a
    // small rotation plus just enough zoom to hide the corners.
    transform: [
      { scaleX: edit.flip ? -1 : 1 },
      { rotate: `${edit.rotation + edit.straighten}deg` },
      { scale: zoom },
    ],
  };
}

/** Freehand drawings, as SVG paths over the frame. */
export function DrawingLayer({ strokes, width, height }: { strokes: Stroke[]; width: number; height: number }) {
  if (strokes.length === 0) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {strokes.map((stroke, i) => {
        const d = strokePath(stroke, width, height);
        const w = Math.max(1, stroke.width * width);
        return stroke.kind === 'neon' ? (
          <G key={i}>
            <Path d={d} stroke={stroke.color} strokeWidth={w * 3} strokeOpacity={0.35} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={d} stroke="#FFFFFF" strokeWidth={w * 0.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </G>
        ) : (
          <Path
            key={i}
            d={d}
            stroke={stroke.color}
            strokeWidth={stroke.kind === 'marker' ? w * 2.5 : w}
            strokeOpacity={stroke.kind === 'marker' ? 0.45 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}

/** Color washes and the vignette, drawn over the photo. */
function Finish({ edit }: { edit: Edit }) {
  const vignette = vignetteOf(edit);
  return (
    <>
      {overlays(edit).map((o, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: o.color, opacity: o.opacity },
            o.blend && { mixBlendMode: o.blend },
          ]}
        />
      ))}
      {vignette > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(vignette * 0.85).toFixed(2)}) 100%)`,
            },
          ]}
        />
      )}
    </>
  );
}

/** Centers a caption on its (x, y) point inside the frame. */
export function textPosition(layer: TextLayer, frame: Rect): ViewStyle {
  return {
    position: 'absolute',
    left: layer.x * frame.width,
    top: layer.y * frame.height,
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    maxWidth: frame.width * 0.9,
  };
}

export function TextLayerView({ layer, frameWidth }: { layer: TextLayer; frameWidth: number }) {
  const fontSize = Math.max(8, layer.size * frameWidth);
  const dark = layer.color === '#111111';
  const look: Record<TextLayer['style'], TextStyle> = {
    classic: {
      fontWeight: 600,
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowRadius: fontSize / 8,
      textShadowOffset: { width: 0, height: 1 },
    },
    strong: { fontWeight: 900, textTransform: 'uppercase', letterSpacing: -0.5 },
    box: {
      fontWeight: 800,
      color: dark ? '#FFFFFF' : '#111111',
      backgroundColor: layer.color,
      paddingHorizontal: fontSize * 0.35,
      paddingVertical: fontSize * 0.12,
      borderRadius: fontSize * 0.25,
      overflow: 'hidden',
    },
    serif: { fontFamily: Fonts.serif, fontStyle: 'italic', fontWeight: 500 },
    neon: {
      fontWeight: 700,
      textShadowColor: layer.color,
      textShadowRadius: fontSize / 2.5,
      textShadowOffset: { width: 0, height: 0 },
    },
    type: { fontFamily: Fonts.mono, fontWeight: 500 },
  };
  return (
    <Text
      style={[
        { color: layer.style === 'neon' ? '#FFFFFF' : layer.color, fontSize, lineHeight: fontSize * 1.2, textAlign: 'center' },
        look[layer.style],
      ]}>
      {layer.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
