import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export const MIN_SCALE = 0.12;
export const MAX_SCALE = 2.6;
/** Breathing room left around the content when fitting it to the screen. */
const FIT_MARGIN = 28;

export type Rect = { x: number; y: number; width: number; height: number };
/** A full-bleed horizontal stripe, positioned in content coordinates. */
export type Band = { key: string; y: number; height: number; color: string };
export type Insets = { top?: number; right?: number; bottom?: number; left?: number };

export type PanZoomHandle = {
  fit: (animated?: boolean) => void;
  /** Centre a rectangle given in content coordinates. */
  focusRect: (rect: Rect, targetScale?: number, animated?: boolean) => void;
  zoomBy: (factor: number) => void;
  /** The scale `fit` would land on, so callers can decide if it is legible. */
  fitScale: () => number;
};

export type PanZoomProps = {
  /** Size of the real content, excluding the pannable margin. */
  innerWidth: number;
  innerHeight: number;
  /** Pannable margin added on every side. */
  padding: number;
  fitInsets?: Insets;
  onScaleChange?: (scale: number) => void;
  /**
   * Stripes drawn behind the content and across the whole viewport. They have
   * to live outside the content layer: anything inside it is clipped to the
   * content box, which would leave a visible vertical edge mid-canvas.
   */
  bands?: Band[];
  children: ReactNode;
  ref?: Ref<PanZoomHandle>;
};

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/**
 * A pan, pinch and zoom viewport. Both canvases in the app — the family tree
 * and a single person's life — are the same interaction with different
 * contents, so the gesture handling lives here once.
 */
export function PanZoom({
  innerWidth,
  innerHeight,
  padding,
  fitInsets,
  onScaleChange,
  bands,
  children,
  ref,
}: PanZoomProps) {
  const containerRef = useRef<View>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const contentWidth = innerWidth + padding * 2;
  const contentHeight = innerHeight + padding * 2;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  const inset = {
    top: fitInsets?.top ?? 0,
    right: fitInsets?.right ?? 0,
    bottom: fitInsets?.bottom ?? 0,
    left: fitInsets?.left ?? 0,
  };
  const frameWidth = Math.max(1, viewport.width - inset.left - inset.right);
  const frameHeight = Math.max(1, viewport.height - inset.top - inset.bottom);

  const reportScale = useCallback(
    (value: number) => {
      onScaleChange?.(value);
    },
    [onScaleChange],
  );

  const applyView = useCallback(
    (nextScale: number, nextX: number, nextY: number, animated: boolean) => {
      if (animated) {
        scale.value = withTiming(nextScale, { duration: 340 });
        translateX.value = withTiming(nextX, { duration: 340 });
        translateY.value = withTiming(nextY, { duration: 340 });
      } else {
        scale.value = nextScale;
        translateX.value = nextX;
        translateY.value = nextY;
      }
      reportScale(nextScale);
    },
    [reportScale, scale, translateX, translateY],
  );

  const fitScale = useCallback(() => {
    if (viewport.width === 0) return 1;
    return clamp(
      Math.min(
        frameWidth / Math.max(1, innerWidth + FIT_MARGIN * 2),
        frameHeight / Math.max(1, innerHeight + FIT_MARGIN * 2),
      ),
      MIN_SCALE,
      1,
    );
  }, [frameHeight, frameWidth, innerHeight, innerWidth, viewport.width]);

  const fit = useCallback(
    (animated = true) => {
      if (viewport.width === 0 || viewport.height === 0) return;
      const next = fitScale();
      applyView(
        next,
        inset.left + (frameWidth - innerWidth * next) / 2 - padding * next,
        inset.top + (frameHeight - innerHeight * next) / 2 - padding * next,
        animated,
      );
    },
    [applyView, fitScale, frameHeight, frameWidth, innerHeight, innerWidth, inset.left, inset.top, padding, viewport.height, viewport.width],
  );

  const focusRect = useCallback(
    (rect: Rect, targetScale?: number, animated = true) => {
      if (viewport.width === 0) return;
      const next = clamp(targetScale ?? Math.max(scale.value, 0.85), MIN_SCALE, MAX_SCALE);
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      applyView(next, inset.left + frameWidth / 2 - cx * next, inset.top + frameHeight / 2 - cy * next, animated);
    },
    [applyView, frameHeight, frameWidth, inset.left, inset.top, scale, viewport.width],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const next = clamp(scale.value * factor, MIN_SCALE, MAX_SCALE);
      const cx = inset.left + frameWidth / 2;
      const cy = inset.top + frameHeight / 2;
      applyView(
        next,
        cx - ((cx - translateX.value) / scale.value) * next,
        cy - ((cy - translateY.value) / scale.value) * next,
        true,
      );
    },
    [applyView, frameHeight, frameWidth, inset.left, inset.top, scale, translateX, translateY],
  );

  useImperativeHandle(ref, () => ({ fit, focusRect, zoomBy, fitScale }), [fit, fitScale, focusRect, zoomBy]);

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => (current.width === width && current.height === height ? current : { width, height }));
  }, []);

  // Trackpad and mouse wheel on the web build: scroll pans, ctrl/⌘+scroll zooms
  // about the pointer, matching every other canvas tool people already know.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = node.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const next = clamp(scale.value * Math.exp(-event.deltaY / 260), MIN_SCALE, MAX_SCALE);
        translateX.value = px - ((px - translateX.value) / scale.value) * next;
        translateY.value = py - ((py - translateY.value) / scale.value) * next;
        scale.value = next;
        reportScale(next);
      } else {
        translateX.value -= event.deltaX;
        translateY.value -= event.deltaY;
      }
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [reportScale, scale, translateX, translateY]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .averageTouches(true)
        .onStart(() => {
          startX.value = translateX.value;
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          translateX.value = startX.value + event.translationX;
          translateY.value = startY.value + event.translationY;
        }),
    [startX, startY, translateX, translateY],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          startScale.value = scale.value;
          startX.value = translateX.value;
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          const next = clamp(startScale.value * event.scale, MIN_SCALE, MAX_SCALE);
          const ratio = next / startScale.value;
          translateX.value = event.focalX - (event.focalX - startX.value) * ratio;
          translateY.value = event.focalY - (event.focalY - startY.value) * ratio;
          scale.value = next;
        })
        .onEnd(() => {
          runOnJS(reportScale)(scale.value);
        }),
    [reportScale, scale, startScale, startX, startY, translateX, translateY],
  );

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .onEnd((event) => {
          const next = clamp(scale.value < 1 ? 1.15 : 0.55, MIN_SCALE, MAX_SCALE);
          const ratio = next / scale.value;
          translateX.value = withTiming(event.x - (event.x - translateX.value) * ratio, { duration: 260 });
          translateY.value = withTiming(event.y - (event.y - translateY.value) * ratio, { duration: 260 });
          scale.value = withTiming(next, { duration: 260 });
          runOnJS(reportScale)(next);
        }),
    [reportScale, scale, translateX, translateY],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(Gesture.Race(doubleTapGesture, panGesture), pinchGesture),
    [doubleTapGesture, panGesture, pinchGesture],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <View ref={containerRef} onLayout={onContainerLayout} style={{ flex: 1, overflow: 'hidden' }} collapsable={false}>
      {bands?.map((band) => (
        <BandStripe key={band.key} band={band} translateY={translateY} scale={scale} />
      ))}
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[{ width: contentWidth, height: contentHeight, transformOrigin: 'top left' }, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function BandStripe({
  band,
  translateY,
  scale,
}: {
  band: Band;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + band.y * scale.value }, { scaleY: scale.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: band.height,
          backgroundColor: band.color,
          transformOrigin: 'top left',
        },
        style,
      ]}
    />
  );
}
