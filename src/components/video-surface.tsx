import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { resolvePlayableUri, type MediaItem } from '@/lib/media';

type VideoSurfaceProps = {
  item: MediaItem;
  contentFit: 'contain' | 'cover';
  nativeControls?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Gallery's own minimal player: tap to play/pause, a thin progress line, no system UI. */
  minimal?: boolean;
  onEnd?: () => void;
};

/** Plays a local or demo video, showing its thumbnail while the file resolves. */
export function VideoSurface(props: VideoSurfaceProps) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolvePlayableUri(props.item)
      .then((resolved) => !cancelled && setUri(resolved))
      .catch((error) => console.warn('Could not load video', error));
    return () => {
      cancelled = true;
    };
  }, [props.item]);

  return (
    <View style={styles.fill}>
      <Image
        source={{ uri: props.item.thumbUri }}
        style={StyleSheet.absoluteFill}
        contentFit={props.contentFit}
      />
      {uri && <Player key={uri} uri={uri} {...props} />}
    </View>
  );
}

function Player({
  uri,
  contentFit,
  nativeControls = false,
  loop = false,
  muted = false,
  minimal = false,
  onEnd,
}: VideoSurfaceProps & { uri: string }) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = muted;
    if (minimal) p.timeUpdateEventInterval = 0.25;
    p.play();
  });

  useEventListener(player, 'playToEnd', () => onEnd?.());
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) setProgress(currentTime / player.duration);
  });

  const video = (
    <VideoView player={player} style={styles.fill} contentFit={contentFit} nativeControls={nativeControls && !minimal} />
  );
  if (!minimal) return video;

  return (
    <Pressable
      style={styles.fill}
      accessibilityLabel={paused ? 'Play' : 'Pause'}
      onPress={() => {
        if (paused) player.play();
        else player.pause();
        setPaused(!paused);
      }}>
      {video}
      {paused && (
        <View style={styles.center} pointerEvents="none">
          <View style={styles.playBadge}>
            <Icon ios="play.fill" android="play_arrow" size={40} color="#fff" />
          </View>
        </View>
      )}
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.progress, { width: `${Math.min(1, progress) * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // Sits just above the viewer's action bar.
  track: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 104,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    backgroundColor: '#fff',
  },
});
