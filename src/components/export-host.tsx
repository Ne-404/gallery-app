import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { EditedImage } from '@/components/edited-image';
import { aspectRatio } from '@/lib/edits';
import { finishExport, useExportRequest } from '@/lib/export';

const LAYOUT_WIDTH = 360;
const OUTPUT_WIDTH = 1440;
const TIMEOUT_MS = 12000;

/** Draws the photo being exported off-screen and captures it to a JPEG file. */
export function ExportHost() {
  const request = useExportRequest();
  const view = useRef<ComponentRef<typeof View>>(null);

  // Give up (and share the original) if the photo never loads.
  useEffect(() => {
    if (!request) return;
    const timer = setTimeout(() => finishExport(null), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [request]);

  if (!request) return null;
  const { item, edit } = request;
  const ratio = aspectRatio(edit, item.width, item.height);
  const height = LAYOUT_WIDTH / ratio;

  const capture = () => {
    // Let the edits paint before capturing.
    setTimeout(async () => {
      try {
        const uri = await captureRef(view as Parameters<typeof captureRef>[0], {
          format: 'jpg',
          quality: 0.92,
          result: 'tmpfile',
          width: OUTPUT_WIDTH,
          height: Math.round(OUTPUT_WIDTH / ratio),
        });
        finishExport(uri);
      } catch {
        finishExport(null);
      }
    }, 350);
  };

  return (
    <View pointerEvents="none" style={styles.offscreen}>
      <View ref={view} collapsable={false} style={{ width: LAYOUT_WIDTH, height }}>
        <EditedImage
          key={item.id}
          uri={item.uri}
          edit={edit}
          sourceAspect={item.width / item.height}
          style={StyleSheet.absoluteFill}
          transition={0}
          priority="high"
          onLoad={capture}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -10000,
  },
});
