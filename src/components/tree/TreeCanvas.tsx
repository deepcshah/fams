import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { PanZoom, type Band, type Insets, type PanZoomHandle } from '@/components/PanZoom';
import { AppText } from '@/components/Text';
import { NODE_H, ROW_GAP, ROW_H, type TreeLayout } from '@/lib/layout';
import { useTheme } from '@/theme';
import type { Person, UnionStatus } from '@/types';

import { PersonNode } from './PersonNode';

export const CANVAS_PADDING = 140;
/** Below this the names stop being readable, so we frame a person instead. */
const LEGIBLE_SCALE = 0.46;

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
  showLifespans: boolean;
  onSelect: (personId: string) => void;
  onLongPressPerson: (personId: string) => void;
  onToggleCollapse: (unitId: string) => void;
  onScaleChange?: (scale: number) => void;
  /** Screen edges covered by floating chrome, kept clear when fitting. */
  fitInsets?: Insets;
  /** Framed on first paint when the whole tree would be too small to read. */
  initialFocusId?: string;
  ref?: Ref<TreeCanvasHandle>;
};

/** Dashed for a partnership that ended, solid otherwise. */
function dashFor(status: UnionStatus | undefined): string | undefined {
  return status === 'divorced' || status === 'separated' ? '5 4' : undefined;
}

export function TreeCanvas({
  layout,
  people,
  selectedId,
  homeId,
  highlightIds,
  showLifespans,
  onSelect,
  onLongPressPerson,
  onToggleCollapse,
  onScaleChange,
  fitInsets,
  initialFocusId,
  ref,
}: TreeCanvasProps) {
  const theme = useTheme();
  const viewportRef = useRef<PanZoomHandle>(null);
  const [ready, setReady] = useState(false);

  const offsetX = CANVAS_PADDING - layout.bounds.minX;
  const offsetY = CANVAS_PADDING - layout.bounds.minY;

  const centerOn = useCallback(
    (personId: string, targetScale?: number, animated = true) => {
      const node = layout.nodeById[personId];
      if (!node) return;
      viewportRef.current?.focusRect(
        { x: node.x + offsetX, y: node.y + offsetY, width: node.width, height: node.height },
        targetScale,
        animated,
      );
    },
    [layout.nodeById, offsetX, offsetY],
  );

  useImperativeHandle(
    ref,
    () => ({
      fit: (animated) => viewportRef.current?.fit(animated),
      centerOn,
      zoomBy: (factor) => viewportRef.current?.zoomBy(factor),
    }),
    [centerOn],
  );

  // Fit once the viewport and layout are both known. On a phone a wide tree
  // fits at a scale nobody can read, so frame the person it is about instead
  // and leave the overview to the Fit button.
  const signature = `${Math.round(layout.width)}x${Math.round(layout.height)}:${ready}`;
  const lastFit = useRef('');
  useEffect(() => {
    if (!ready) return;
    if (lastFit.current === signature) return;
    const first = lastFit.current === '';
    lastFit.current = signature;

    const anchorId = initialFocusId && layout.nodeById[initialFocusId] ? initialFocusId : layout.nodes[0]?.personId;
    const fitsLegibly = (viewportRef.current?.fitScale() ?? 1) >= LEGIBLE_SCALE;
    if (first && anchorId && !fitsLegibly) {
      centerOn(anchorId, 0.75, false);
      return;
    }
    viewportRef.current?.fit(!first);
  }, [centerOn, initialFocusId, layout.nodeById, layout.nodes, ready, signature]);

  const hasHighlight = Boolean(highlightIds && highlightIds.size > 0);
  const innerWidth = layout.width;
  const innerHeight = layout.height;

  // Generation registers: alternate stripes, barely there, so the eye can tell
  // one generation from the next without a rule across the canvas.
  const bands: Band[] = layout.generationRows
    .filter((_, index) => index % 2 === 1)
    .map((row) => ({
      key: `row_${row.generation}`,
      y: row.y - ROW_GAP / 2 + offsetY,
      height: ROW_H,
      color: theme.colors.canvasBand,
    }));

  return (
    <View style={{ flex: 1 }} onLayout={() => setReady(true)}>
      <PanZoom
        ref={viewportRef}
        innerWidth={innerWidth}
        innerHeight={innerHeight}
        padding={CANVAS_PADDING}
        fitInsets={fitInsets}
        onScaleChange={onScaleChange}
        bands={bands}>
        <Svg
          width={innerWidth + CANVAS_PADDING * 2}
          height={innerHeight + CANVAS_PADDING * 2}
          style={{ position: 'absolute', left: 0, top: 0 }}
          pointerEvents="none">
          <G transform={`translate(${offsetX}, ${offsetY})`}>
            {layout.descentLinks.map((link) => (
              <Path key={link.id} d={link.path} stroke={theme.colors.line} strokeWidth={1} fill="none" />
            ))}
            {layout.partnerLinks.map((link) => (
              <Line
                key={link.id}
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke={theme.colors.line}
                strokeWidth={1.4}
                strokeDasharray={dashFor(link.status)}
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
              showLifespans={showLifespans}
              onPress={onSelect}
              onLongPress={onLongPressPerson}
            />
          );
        })}

        {layout.units.map((unit) => {
          if (!unit.collapsed && unit.childIds.length === 0) return null;
          const badgeSize = 22;
          return (
            <Pressable
              key={`badge_${unit.id}`}
              accessibilityRole="button"
              accessibilityLabel={unit.collapsed ? `Expand ${unit.hiddenDescendants} descendants` : 'Collapse branch'}
              onPress={() => onToggleCollapse(unit.id)}
              style={{
                position: 'absolute',
                left: unit.x + offsetX + unit.width / 2 - (unit.collapsed ? 19 : badgeSize / 2),
                top: (unit.collapsed ? unit.y + NODE_H + ROW_GAP * 0.3 : unit.busY - badgeSize / 2) + offsetY,
                height: badgeSize,
                minWidth: badgeSize,
                paddingHorizontal: unit.collapsed ? 7 : 0,
                borderRadius: badgeSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 2,
                backgroundColor: unit.collapsed ? theme.colors.accentSoft : theme.colors.canvas,
                borderWidth: unit.collapsed ? StyleSheet.hairlineWidth * 2 : 0,
                borderColor: theme.colors.accent,
              }}>
              <Icon
                name={unit.collapsed ? 'chevronDown' : 'chevronUp'}
                size={11}
                color={unit.collapsed ? theme.colors.accent : theme.colors.line}
              />
              {unit.collapsed ? (
                <AppText variant="yearSM" style={{ color: theme.colors.accent }}>
                  {unit.hiddenDescendants}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </PanZoom>
    </View>
  );
}
