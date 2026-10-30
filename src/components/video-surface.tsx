import { useEventListener } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Image } from 'expo-image';
import {
  isPictureInPictureSupported,
  useVideoPlayer,
  VideoView,
  type VideoPlayer,
  type VideoThumbnail,
} from 'expo-video';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { GestureDetector, useExclusiveGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { Slider } from '@/components/slider';
import { Spacing } from '@/constants/theme';
import { formatDuration } from '@/lib/dates';
import { dirProps, dirStyle } from '@/lib/direction';
import { useT } from '@/lib/i18n';
import { resolvePlayableUri, type MediaItem } from '@/lib/media';
import { showToast } from '@/lib/toast';
import { setVideoPosition, userData } from '@/lib/user-data';

/** VLC's traffic-cone orange. */
export const PlayerOrange = '#FF8800';

const SKIP_SECONDS = 10;
/** Arrow keys skip less than J/L and double taps. */
const KEY_SKIP_SECONDS = 5;
const HIDE_AFTER_MS = 3000;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const VOLUME_STEP = 0.1;
/** Videos at least this long remember where they were left off… */
const RESUME_MIN_LENGTH = 30;
/** …unless that's within this many seconds of the start or end. */
const RESUME_MARGIN = 5;

type VideoSurfaceProps = {
  item: MediaItem;
  contentFit: 'contain' | 'cover';
  /**
   * The VLC-style controls (seek, skip, play, mute, …). Without them the video plays bare
   * (stories, previews).
   */
  controls?: boolean;
  /** Whether the controls are showing; the viewer shares this with its top bar. */
  chrome?: boolean;
  onChromeChange?: (visible: boolean) => void;
  /** Keep playing (with a media notification) when the app goes to the background. */
  background?: boolean;
  onBackgroundChange?: (background: boolean) => void;
  loop?: boolean;
  /** Shows a loop toggle in the controls. */
  onLoopChange?: (loop: boolean) => void;
  muted?: boolean;
  onEnd?: () => void;
  /** Esc on a keyboard (web). */
  onClose?: () => void;
};

/** Plays a local video, showing its thumbnail while the file resolves. */
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
  item,
  contentFit,
  controls,
  chrome = true,
  onChromeChange,
  background = false,
  onBackgroundChange,
  loop = false,
  onLoopChange,
  muted = false,
  onEnd,
  onClose,
}: VideoSurfaceProps & { uri: string }) {
  const t = useT();
  // On web nothing plays until the <video> element mounts (and the browser may block
  // autoplay), so it starts as paused there and follows the player's events.
  const [playing, setPlaying] = useState(Platform.OS !== 'web');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  // Quarter turns, for sideways videos on a portrait screen.
  const [turns, setTurns] = useState(0);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const view = useRef<ComponentRef<typeof VideoView>>(null);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = muted;
    if (controls) p.timeUpdateEventInterval = 0.25;
    p.play();
  });

  useEffect(() => setBackgroundPlay(player, background), [player, background]);
  useEffect(() => setLoop(player, loop), [player, loop]);
  useEffect(() => {
    if (Platform.OS === 'web') player.play();
  }, [player]);

  // Where playback is, so the spot can be saved when the video closes. Kept from event
  // payloads: the player itself may already be released by then.
  const position = useRef({ time: 0, duration: 0, resumed: false });
  useEffect(() => {
    const spot = position.current;
    return () => {
      if (!controls) return;
      const { time: at, duration: length } = spot;
      const worthKeeping = length >= RESUME_MIN_LENGTH && at >= RESUME_MARGIN && at <= length - RESUME_MARGIN;
      setVideoPosition(item.id, worthKeeping ? Math.floor(at) : null);
    };
  }, [controls, item.id]);

  // Picks up where a long video was left off, with a way to start over instead.
  const knowDuration = (length: number) => {
    if (length <= 0) return;
    setDuration(length);
    position.current.duration = length;
    if (!controls || position.current.resumed) return;
    position.current.resumed = true;
    const saved = userData.get().videoPositions[item.id];
    if (!saved || saved > length - RESUME_MARGIN) return;
    seekPlayer(player, saved);
    showToast(t('Resumed at {time}', { time: formatDuration(saved) }), {
      label: t('Start over'),
      onPress: () => seekPlayer(player, 0),
    });
  };

  // Listeners only use their payloads: reading the player from an event that arrives while it's
  // being released throws on Android.
  useEventListener(player, 'playToEnd', () => {
    position.current.time = 0;
    onEnd?.();
  });
  useEventListener(player, 'playingChange', ({ isPlaying }) => setPlaying(isPlaying));
  useEventListener(player, 'sourceLoad', ({ duration: length }) => knowDuration(length));
  useEventListener(player, 'timeUpdate', ({ currentTime, bufferedPosition }) => {
    setTime(currentTime);
    setBuffered(bufferedPosition);
    position.current.time = currentTime;
  });
  // On web `sourceLoad` can fire before this listener exists, so the length is also read once
  // the video is ready (guarded: the player may already be released).
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && !position.current.duration) knowDuration(readDuration(player));
  });

  const toggle = () => (playing ? player.pause() : player.play());
  // A sideways turn swaps the video's box, so it still fits the screen.
  const sideways = turns % 2 === 1 && box.width > 0;
  const turned = turns
    ? {
        position: 'absolute' as const,
        width: sideways ? box.height : box.width,
        height: sideways ? box.width : box.height,
        left: sideways ? (box.width - box.height) / 2 : 0,
        top: sideways ? (box.height - box.width) / 2 : 0,
        transform: [{ rotate: `${turns * 90}deg` }],
      }
    : styles.fill;
  const video = (
    <View style={styles.fill} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      {/* Turned on a wrapper: the web video view ignores transforms on itself. */}
      <View style={turned}>
        <VideoView
          ref={view}
          player={player}
          style={styles.fill}
          contentFit={contentFit}
          nativeControls={false}
          // The system's full-screen player rotates with the phone.
          fullscreenOptions={{ enable: true, orientation: 'default' }}
          allowsPictureInPicture={controls && canUsePictureInPicture()}
        />
      </View>
    </View>
  );

  if (controls) {
    return (
      <FullControls
        player={player}
        playing={playing}
        time={time}
        duration={duration}
        buffered={buffered}
        sourceAspect={item.width / item.height}
        chrome={chrome}
        onChromeChange={onChromeChange}
        onRotate={() => setTurns((n) => (n + 1) % 4)}
        background={background}
        onBackgroundChange={onBackgroundChange}
        loop={loop}
        onLoopChange={onLoopChange}
        onToggle={toggle}
        onNativeFullscreen={() => view.current?.enterFullscreen()}
        onPictureInPicture={() =>
          view.current
            ?.startPictureInPicture()
            .catch(() => showToast(t('Picture in picture isn’t available here')))
        }
        onClose={onClose}>
        {video}
      </FullControls>
    );
  }
  return video;
}

type Flash = { id: number; side: 'left' | 'center' | 'right'; icon: IconName; text?: string };
type IconName = Pick<React.ComponentProps<typeof Icon>, 'ios' | 'android'>;

/**
 * VLC-style: a dark bottom panel with an orange seek bar, times, skip ±10 s, play and mute,
 * plus speed, loop, picture-in-picture and full screen. Double-tap the sides to skip; on a
 * keyboard, Space/K, arrows, J/L, M, F and Esc work too.
 */
function FullControls({
  player,
  playing,
  time,
  duration,
  buffered,
  sourceAspect,
  chrome,
  onChromeChange,
  onRotate,
  background,
  onBackgroundChange,
  loop,
  onLoopChange,
  onToggle,
  onNativeFullscreen,
  onPictureInPicture,
  onClose,
  children,
}: {
  player: VideoPlayer;
  playing: boolean;
  time: number;
  duration: number;
  buffered: number;
  sourceAspect: number;
  chrome: boolean;
  onChromeChange?: (visible: boolean) => void;
  onRotate: () => void;
  background: boolean;
  onBackgroundChange?: (background: boolean) => void;
  loop: boolean;
  onLoopChange?: (loop: boolean) => void;
  onToggle: () => void;
  onNativeFullscreen: () => void;
  onPictureInPicture: () => void;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const root = useRef<ComponentRef<typeof View>>(null);
  const [muted, setMuted] = useState(player.muted);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  // While dragging the seek bar: where it's at. The video only seeks on release.
  const [scrub, setScrub] = useState<number | null>(null);
  const [frame, setFrame] = useState<VideoThumbnail | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  // Bumped on every touch, so the controls stay up while they're being used.
  const [touchedAt, setTouchedAt] = useState(0);
  const touch = () => setTouchedAt(Date.now());

  // While playing, the controls fade away after a few idle seconds.
  useEffect(() => {
    if (!chrome || !playing || scrub !== null) return;
    const timer = setTimeout(() => onChromeChange?.(false), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [chrome, playing, scrub, touchedAt, onChromeChange]);

  // A short icon (and label) over the video after a double tap or a key press.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(timer);
  }, [flash]);
  const showFlash = (side: Flash['side'], icon: IconName, text?: string) =>
    setFlash({ id: Date.now(), side, icon, text });

  const seekTo = (seconds: number) => {
    touch();
    seekPlayer(player, Math.max(0, Math.min(duration || seconds, seconds)));
  };
  const skip = (seconds: number) => {
    seekTo(readTime(player, time) + seconds);
    const back = seconds < 0;
    const icon: IconName =
      Math.abs(seconds) === SKIP_SECONDS
        ? back
          ? { ios: 'gobackward.10', android: 'replay_10' }
          : { ios: 'goforward.10', android: 'forward_10' }
        : back
          ? { ios: 'gobackward.5', android: 'replay_5' }
          : { ios: 'goforward.5', android: 'forward_5' };
    showFlash(back ? 'left' : 'right', icon);
  };
  const toggleChrome = () => {
    touch();
    onChromeChange?.(!chrome);
  };
  const toggleMute = () => {
    touch();
    mutePlayer(player, !muted);
    setMuted(!muted);
    showFlash(
      'center',
      muted ? { ios: 'speaker.wave.2.fill', android: 'volume_up' } : { ios: 'speaker.slash.fill', android: 'volume_off' }
    );
  };
  const changeVolume = (step: number) => {
    const volume = Math.round(Math.min(1, Math.max(0, readVolume(player) + step)) * 100) / 100;
    setVolume(player, volume);
    if (muted && step > 0) {
      mutePlayer(player, false);
      setMuted(false);
    }
    showFlash('center', { ios: 'speaker.wave.2.fill', android: 'volume_up' }, t('Volume {n}%', { n: Math.round(volume * 100) }));
  };
  const cycleSpeed = () => {
    touch();
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setRate(player, next);
    setSpeed(next);
  };
  const toggleFullscreen = () => {
    touch();
    if (Platform.OS !== 'web') return onNativeFullscreen();
    // On web the whole player (video and these controls) goes full screen, not just <video>.
    const element = root.current as unknown as HTMLElement | null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else element?.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Keyboard shortcuts on web (ignored while typing in a field).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      const actions: Record<string, () => void> = {
        ' ': onToggle,
        k: onToggle,
        ArrowLeft: () => skip(-KEY_SKIP_SECONDS),
        ArrowRight: () => skip(KEY_SKIP_SECONDS),
        j: () => skip(-SKIP_SECONDS),
        l: () => skip(SKIP_SECONDS),
        ArrowUp: () => changeVolume(VOLUME_STEP),
        ArrowDown: () => changeVolume(-VOLUME_STEP),
        m: toggleMute,
        f: toggleFullscreen,
        // In full screen the browser uses Esc to leave it.
        Escape: () => !document.fullscreenElement && onClose?.(),
      };
      const action = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Frame previews while scrubbing (phones only: web can't make thumbnails). One request at a
  // time; when it's done, the latest position is fetched next.
  const frames = useRef({ busy: false, wanted: null as number | null });
  const requestFrame = (seconds: number) => {
    const queue = frames.current;
    if (Platform.OS === 'web') return;
    queue.wanted = seconds;
    if (queue.busy) return;
    queue.busy = true;
    void (async () => {
      while (queue.wanted !== null) {
        const at = queue.wanted;
        queue.wanted = null;
        try {
          const [thumb] = await player.generateThumbnailsAsync(at, { maxWidth: 320 });
          setFrame(thumb ?? null);
        } catch {
          // The player was released, or this format has no frames to give.
        }
      }
      queue.busy = false;
    })();
  };

  const shown = scrub ?? time;
  const pip = canUsePictureInPicture();

  return (
    <View ref={root} style={[styles.fill, fullscreen && styles.fullscreen]}>
      {children}
      <TapLayer
        label={chrome ? t('Hide controls') : t('Show controls')}
        onTap={toggleChrome}
        onDoubleTap={(side) => skip(side === 'left' ? -SKIP_SECONDS : SKIP_SECONDS)}
      />

      {flash && (
        <Animated.View
          key={flash.id}
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(250)}
          pointerEvents="none"
          style={[styles.flash, flash.side === 'left' ? styles.flashLeft : flash.side === 'right' ? styles.flashRight : null]}>
          <View style={styles.flashBubble}>
            <Icon {...flash.icon} size={34} color="#fff" />
            {flash.text ? <Text style={styles.flashText}>{flash.text}</Text> : null}
          </View>
        </Animated.View>
      )}

      {!playing && chrome && (
        <View style={styles.center} pointerEvents="box-none">
          <Pressable
            onPress={(e) => {
              onToggle();
              blurAfterMouse(e);
            }}
            accessibilityLabel={t('Play')}
            style={styles.bigPlay}>
            <Icon ios="play.fill" android="play_arrow" size={44} color="#fff" />
          </Pressable>
        </View>
      )}

      <View
        style={[styles.panel, { paddingBottom: insets.bottom + Spacing.two }, !chrome && styles.hidden]}
        pointerEvents={chrome ? 'auto' : 'none'}>
        {scrub !== null && (
          <View style={styles.preview} pointerEvents="none">
            {frame && (
              <Image
                source={frame}
                style={[styles.previewFrame, { aspectRatio: sourceAspect || 16 / 9 }]}
                contentFit="cover"
              />
            )}
            <Text style={styles.previewTime}>{formatDuration(scrub)}</Text>
          </View>
        )}
        {/* Speed, loop, picture-in-picture and full screen: smaller, above the seek bar. */}
        <View {...dirProps('ltr')} style={[styles.optionRow, dirStyle('ltr')]}>
          <ControlButton label={t('Playback speed {rate}', { rate: `${speed}×` })} onPress={cycleSpeed} compact>
            <Text style={[styles.speed, speed !== 1 && { color: PlayerOrange }]}>{speed}×</Text>
          </ControlButton>
          {onLoopChange && (
            <ControlButton
              label={loop ? t('Loop on') : t('Loop off')}
              compact
              onPress={() => {
                touch();
                onLoopChange(!loop);
              }}>
              <Icon ios="repeat" android="repeat" size={20} color={loop ? PlayerOrange : '#fff'} />
            </ControlButton>
          )}
          {pip && (
            <ControlButton
              label={t('Picture in picture')}
              compact
              onPress={() => {
                touch();
                onPictureInPicture();
              }}>
              <Icon ios="pip.enter" android="picture_in_picture_alt" size={20} color="#fff" />
            </ControlButton>
          )}
          <ControlButton label={fullscreen ? t('Exit full screen') : t('Full screen')} compact onPress={toggleFullscreen}>
            <Icon
              ios={fullscreen ? 'arrow.down.right.and.arrow.up.left' : 'arrow.up.left.and.arrow.down.right'}
              android={fullscreen ? 'fullscreen_exit' : 'fullscreen'}
              size={20}
              color="#fff"
            />
          </ControlButton>
        </View>
        {/* Time runs left to right in every language, like the seek bar. */}
        <View {...dirProps('ltr')} style={[styles.seekRow, dirStyle('ltr')]}>
          <Text style={styles.time}>{formatDuration(shown)}</Text>
          <View style={styles.fill}>
            <Slider
              value={shown}
              min={0}
              max={Math.max(duration, 0.01)}
              buffered={buffered}
              color={PlayerOrange}
              onSlidingStart={() => setScrub(time)}
              onChange={(seconds) => {
                touch();
                setScrub(seconds);
                requestFrame(seconds);
              }}
              onSlidingEnd={(seconds) => {
                seekTo(seconds);
                setScrub(null);
                setFrame(null);
              }}
            />
          </View>
          <Text style={styles.time}>{formatDuration(duration)}</Text>
        </View>
        <View {...dirProps('ltr')} style={[styles.buttonRow, dirStyle('ltr')]}>
          <View style={styles.side}>
            <ControlButton
              label={t('Rotate')}
              onPress={() => {
                touch();
                onRotate();
              }}>
              <Icon ios="rotate.right" android="rotate_right" size={22} color="#fff" />
            </ControlButton>
          </View>
          <ControlButton label={t('Back 10 seconds')} onPress={() => seekTo(time - SKIP_SECONDS)}>
            <Icon ios="gobackward.10" android="replay_10" size={28} color="#fff" />
          </ControlButton>
          <Pressable
            onPress={(e) => {
              touch();
              onToggle();
              blurAfterMouse(e);
            }}
            accessibilityLabel={playing ? t('Pause') : t('Play')}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
            <Icon ios={playing ? 'pause.fill' : 'play.fill'} android={playing ? 'pause' : 'play_arrow'} size={30} color="#fff" />
          </Pressable>
          <ControlButton label={t('Forward 10 seconds')} onPress={() => seekTo(time + SKIP_SECONDS)}>
            <Icon ios="goforward.10" android="forward_10" size={28} color="#fff" />
          </ControlButton>
          <View style={[styles.side, styles.sideEnd]}>
            {onBackgroundChange && (
              <ControlButton
                label={background ? t('Background play on') : t('Background play off')}
                onPress={() => {
                  touch();
                  onBackgroundChange(!background);
                }}>
                <Icon ios="headphones" android="headphones" size={22} color={background ? PlayerOrange : '#fff'} />
              </ControlButton>
            )}
            <ControlButton label={muted ? t('Unmute') : t('Mute')} onPress={toggleMute}>
              <Icon
                ios={muted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'}
                android={muted ? 'volume_off' : 'volume_up'}
                size={22}
                color={muted ? PlayerOrange : '#fff'}
              />
            </ControlButton>
          </View>
        </View>
      </View>
    </View>
  );
}

let pictureInPicture: boolean | undefined;
/** Picture-in-picture needs the browser's support or a development build (not Expo Go). */
function canUsePictureInPicture() {
  if (pictureInPicture === undefined) {
    try {
      // expo-video's check is native-only, so the browser is asked directly on web.
      pictureInPicture =
        Platform.OS === 'web'
          ? typeof document.exitPictureInPicture === 'function'
          : Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && isPictureInPictureSupported();
    } catch {
      pictureInPicture = false;
    }
  }
  return pictureInPicture;
}

function readDuration(player: VideoPlayer) {
  try {
    return player.duration > 0 ? player.duration : 0;
  } catch {
    return 0;
  }
}

function readTime(player: VideoPlayer, fallback: number) {
  try {
    return player.currentTime;
  } catch {
    return fallback;
  }
}

function readVolume(player: VideoPlayer) {
  try {
    return player.volume;
  } catch {
    return 1;
  }
}

// The player is an external object: write to it outside render code. Writes are guarded,
// since a toast's "Start over" can arrive after the player was released.
function seekPlayer(player: VideoPlayer, seconds: number) {
  try {
    player.currentTime = seconds;
  } catch {}
}

function mutePlayer(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

function setVolume(player: VideoPlayer, volume: number) {
  player.volume = volume;
}

function setRate(player: VideoPlayer, rate: number) {
  player.playbackRate = rate;
}

function setLoop(player: VideoPlayer, loop: boolean) {
  player.loop = loop;
}

function setBackgroundPlay(player: VideoPlayer, on: boolean) {
  player.staysActiveInBackground = on;
  player.showNowPlayingNotification = on;
}

/**
 * A transparent layer over the whole video: a tap shows or hides the controls, a double tap
 * on the left or right half skips back or forward. It sits on top of the native video view
 * (which can swallow touches on Android) and uses native gestures, so it responds right away
 * even inside the swipeable viewer.
 */
function TapLayer({
  label,
  onTap,
  onDoubleTap,
}: {
  label: string;
  onTap: () => void;
  onDoubleTap: (side: 'left' | 'right') => void;
}) {
  const [width, setWidth] = useState(0);
  const doubleTapAt = (x: number) => onDoubleTap(x < width / 2 ? 'left' : 'right');
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDistance: 24,
    onActivate: (e) => {
      'worklet';
      scheduleOnRN(doubleTapAt, e.x);
    },
  });
  const singleTap = useTapGesture({
    maxDistance: 24,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onTap);
    },
  });
  const taps = useExclusiveGestures(doubleTap, singleTap);
  return (
    <GestureDetector gesture={taps}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={onTap}
      />
    </GestureDetector>
  );
}

/**
 * A mouse click leaves the button focused on web, so Space would press it again instead of
 * playing or pausing; drop the focus after mouse clicks (keyboard presses keep it).
 */
function blurAfterMouse(e: GestureResponderEvent) {
  if (Platform.OS === 'web' && ((e.nativeEvent as unknown as MouseEvent).detail ?? 0) > 0) {
    (document.activeElement as HTMLElement | null)?.blur();
  }
}

function ControlButton({
  label,
  onPress,
  compact,
  children,
}: {
  label: string;
  onPress: () => void;
  /** The smaller option row above the seek bar. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={(e) => {
        onPress();
        blurAfterMouse(e);
      }}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={Spacing.one}
      style={({ pressed }) => [styles.control, compact && styles.compact, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  fullscreen: {
    backgroundColor: '#000',
  },
  hidden: {
    opacity: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigPlay: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  flash: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashLeft: {
    right: '50%',
  },
  flashRight: {
    left: '50%',
  },
  flashBubble: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  flashText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    backgroundColor: 'rgba(18,18,18,0.88)',
  },
  preview: {
    position: 'absolute',
    bottom: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  previewFrame: {
    width: 160,
    borderRadius: Spacing.two,
    borderWidth: 2,
    borderColor: '#fff',
  },
  previewTime: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  speed: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  time: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: {
    width: 88,
    flexDirection: 'row',
  },
  sideEnd: {
    justifyContent: 'flex-end',
  },
  control: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    height: 44,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PlayerOrange,
  },
});
