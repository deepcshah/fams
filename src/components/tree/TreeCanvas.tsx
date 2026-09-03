import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { G, Line, Path } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { AppText } from '@/components/Text';
import { NODE_H, ROW_GAP, type TreeLayout } from '@/lib/layout';
import { useTheme } from '@/theme';
import type { Person, UnionStatus } from '@/types';

import { PersonNode } from './PersonNode';

export const CANVAS_PADDING = 120;
/** Breathing room left around the tree when fitting it to the screen. */
const FIT_MARGIN = 28;
const MIN_SCALE = 0.12;
/** Below this the names stop being readable, so we frame a person instead. */
const LEGIBLE_SCALE = 0.46;
const MAX_SCALE = 2.6;

export type TreeCanvasHandle = {
  fit: (animated?: boolean) => void;
  centerOn: (personId: string, targetScale?: number, animated?: boolean) => void;
  zoomBy: (factor: number) => void;
};

export type TreeCanvasProps = {
  layout: TreeLayout;
  people: Record<string, Person>;
  selectedId?: string;
  homeId?: string;
  highlightIds?: ReadonlySet<string>;
  showPortraits: boolean;
  showLifespans: boolean;
  onSelect: (personId: string) => void;
  onLongPressPerson: (personId: string) => void;
  onToggleCollapse: (unitId: string) => void;
  /** Screen edges covered by floating chrome, kept clear when fitting. */
  fitInsets?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Framed on first paint when the whole tree would be too small to read. */
  initialFocusId?: string;
  ref?: Ref<TreeCanvasHandle>;
};

/** Dashed for a partnership that ended, solid otherwise. */
function dashFor(status: UnionStatus | undefined): string | undefined {
  return status === 'divorced' || status === 'separated' ? '6 5' : undefined;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function TreeCanvas({
  layout,
  people,
  selectedId,
  homeId,
  highlightIds,
  showPortraits,
  showLifespans,
  onSelect,
  onLongPressPerson,
  onToggleCollapse,
  fitInsets,
  initialFocusId,
  ref,
}: TreeCanvasProps) {
  const theme = useTheme();
  const containerRef = useRef<View>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const offsetX = CANVAS_PADDING - layout.bounds.minX;
  const offsetY = CANVAS_PADDING - layout.bounds.minY;
  const contentWidth = layout.width + CANVAS_PADDING * 2;
  const contentHeight = layout.height + CANVAS_PADDING * 2;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  const applyView = useCallback(
    (nextScale: number, nextX: number, nextY: number, animated: boolean) => {
      const duration = animated ? 340 : 0;
      if (animated) {
        scale.value = withTiming(nextScale, { duration });
        translateX.value = withTiming(nextX, { duration });
        translateY.value = withTiming(nextY, { duration });
      } else {
        scale.value = nextScale;
        translateX.value = nextX;
        translateY.value = nextY;
      }
    },
    [scale, translateX, translateY],
  );

  const inset = {
    top: fitInsets?.top ?? 0,
    right: fitInsets?.right ?? 0,
    bottom: fitInsets?.bottom ?? 0,
    left: fitInsets?.left ?? 0,
  };
  // The visible rectangle once the floating header, controls and tab bar are
  // discounted — everything centres inside this, not inside the raw viewport.
  const frameWidth = Math.max(1, viewport.width - inset.left - inset.right);
  const frameHeight = Math.max(1, viewport.height - inset.top - inset.bottom);

  const fit = useCallback(
    (animated = true) => {
      if (viewport.width === 0 || viewport.height === 0) return;
      // Fit the cards themselves, not the pannable margin around them.
      const boxWidth = Math.max(1, layout.width + FIT_MARGIN * 2);
      const boxHeight = Math.max(1, layout.height + FIT_MARGIN * 2);
      const next = clamp(Math.min(frameWidth / boxWidth, frameHeight / boxHeight), MIN_SCALE, 1.15);
      applyView(
        next,
        inset.left + (frameWidth - layout.width * next) / 2 - CANVAS_PADDING * next,
        inset.top + (frameHeight - layout.height * next) / 2 - CANVAS_PADDING * next,
        animated,
      );
    },
    [applyView, frameHeight, frameWidth, inset.left, inset.top, layout.height, layout.width, viewport.height, viewport.width],
  );

  const centerOn = useCallback(
    (personId: string, targetScale?: number, animated = true) => {
      const node = layout.nodeById[personId];
      if (!node || viewport.width === 0) return;
      const next = clamp(targetScale ?? Math.max(scale.value, 0.85), MIN_SCALE, MAX_SCALE);
      const cx = node.x + offsetX + node.width / 2;
      const cy = node.y + offsetY + node.height / 2;
      applyView(
        next,
        inset.left + frameWidth / 2 - cx * next,
        inset.top + frameHeight / 2 - cy * next,
        animated,
      );
    },
    [applyView, frameHeight, frameWidth, inset.left, inset.top, layout.nodeById, offsetX, offsetY, scale, viewport.width],
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

  const fitScale = useCallback(() => {
    if (viewport.width === 0) return 1;
    return clamp(
      Math.min(frameWidth / Math.max(1, layout.width + FIT_MARGIN * 2), frameHeight / Math.max(1, layout.height + FIT_MARGIN * 2)),
      MIN_SCALE,
      1.15,
    );
  }, [frameHeight, frameWidth, layout.height, layout.width, viewport.width]);

  useImperativeHandle(ref, () => ({ fit, centerOn, zoomBy, getScale: () => scale.value }), [
    centerOn,
    fit,
    scale,
    zoomBy,
  ]);

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
      } else {
        translateX.value -= event.deltaX;
        translateY.value -= event.deltaY;
      }
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [scale, translateX, translateY]);

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
        }),
    [scale, startScale, startX, startY, translateX, translateY],
  );

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .onEnd((event) => {
          const zoomingIn = scale.value < 1;
          const next = clamp(zoomingIn ? 1.15 : 0.55, MIN_SCALE, MAX_SCALE);
          const ratio = next / scale.value;
          translateX.value = withTiming(event.x - (event.x - translateX.value) * ratio, { duration: 260 });
          translateY.value = withTiming(event.y - (event.y - translateY.value) * ratio, { duration: 260 });
          scale.value = withTiming(next, { duration: 260 });
        }),
    [scale, translateX, translateY],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(Gesture.Race(doubleTapGesture, panGesture), pinchGesture),
    [doubleTapGesture, panGesture, pinchGesture],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Fit once the viewport and layout are both known.
  const fitSignature = `${viewport.width}x${viewport.height}:${Math.round(contentWidth)}x${Math.round(contentHeight)}`;
  const lastFitRef = useRef<string>('');
  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0) return;
    if (lastFitRef.current === fitSignature) return;
    const first = lastFitRef.current === '';
    lastFitRef.current = fitSignature;

    // On a phone a wide tree fits at a scale nobody can read. Frame the person
    // the tree is about instead, and leave "fit" to the overview button.
    const anchorId = initialFocusId && layout.nodeById[initialFocusId] ? initialFocusId : layout.nodes[0]?.personId;
    if (first && anchorId && fitScale() < LEGIBLE_SCALE) {
      centerOn(anchorId, 0.75, false);
      return;
    }
    fit(!first);
  }, [centerOn, fit, fitScale, fitSignature, initialFocusId, layout.nodeById, layout.nodes, viewport.height, viewport.width]);

  const hasHighlight = Boolean(highlightIds && highlightIds.size > 0);

  return (
    <View ref={containerRef} onLayout={onContainerLayout} style={{ flex: 1, overflow: 'hidden' }} collapsable={false}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[{ width: contentWidth, height: contentHeight, transformOrigin: 'top left' }, animatedStyle]}>
          <Svg
            width={contentWidth}
            height={contentHeight}
            style={{ position: 'absolute', left: 0, top: 0 }}
            pointerEvents="none">
            <G transform={`translate(${offsetX}, ${offsetY})`}>
              {layout.generationRows.map((row) => (
                <Line
                  key={`row_${row.generation}`}
                  x1={layout.bounds.minX - CANVAS_PADDING}
                  y1={row.y - ROW_GAP / 2}
                  x2={layout.bounds.maxX + CANVAS_PADDING}
                  y2={row.y - ROW_GAP / 2}
                  stroke={theme.colors.canvasGrid}
                  strokeWidth={1}
                />
              ))}
              {layout.descentLinks.map((link) => (
                <Path
                  key={link.id}
                  d={link.path}
                  stroke={theme.colors.line}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
              {layout.partnerLinks.map((link) => (
                <Line
                  key={link.id}
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  stroke={theme.colors.line}
                  strokeWidth={2.2}
                  strokeDasharray={dashFor(link.status)}
                  strokeLinecap="round"
                />
              ))}
            </G>
          </Svg>

          {layout.nodes.map((node) => {
            const person = people[node.personId];
            if (!person) return null;
            return (
              <PersonNode
                key={node.personId}
                person={person}
                node={node}
                left={node.x + offsetX}
                top={node.y + offsetY}
                selected={selectedId === node.personId}
                isHome={homeId === node.personId}
                dimmed={hasHighlight && !highlightIds!.has(node.personId)}
                showPortraits={showPortraits}
                showLifespans={showLifespans}
                onPress={onSelect}
                onLongPress={onLongPressPerson}
              />
            );
          })}

          {layout.units.map((unit) => {
            const hasChildren = unit.childIds.length > 0 || unit.collapsed;
            if (!hasChildren) return null;
            if (!unit.collapsed && unit.childIds.length === 0) return null;
            const badgeSize = 24;
            return (
              <Pressable
                key={`badge_${unit.id}`}
                accessibilityRole="button"
                accessibilityLabel={unit.collapsed ? `Expand ${unit.hiddenDescendants} descendants` : 'Collapse branch'}
                onPress={() => onToggleCollapse(unit.id)}
                style={{
                  position: 'absolute',
                  left: unit.x + offsetX + unit.width / 2 - (unit.collapsed ? 20 : badgeSize / 2),
                  top: (unit.collapsed ? unit.y + NODE_H + ROW_GAP * 0.3 : unit.busY - badgeSize / 2) + offsetY,
                  height: badgeSize,
                  minWidth: badgeSize,
                  paddingHorizontal: unit.collapsed ? 8 : 0,
                  borderRadius: badgeSize / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 3,
                  backgroundColor: unit.collapsed ? theme.colors.accentSoft : theme.colors.canvas,
                  borderWidth: 1,
                  borderColor: unit.collapsed ? theme.colors.accent : theme.colors.border,
                }}>
                <Icon
                  name={unit.collapsed ? 'chevronDown' : 'chevronUp'}
                  size={13}
                  color={unit.collapsed ? theme.colors.accent : theme.colors.textMuted}
                />
                {unit.collapsed ? (
                  <AppText variant="caption" style={{ color: theme.colors.accent, fontSize: 11 }}>
                    {unit.hiddenDescendants}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
