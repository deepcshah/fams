import { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

import { AppText } from './Text';

/**
 * An abstract map tile for a place name. Real cartography needs a tile server
 * and an API key; what the eye actually wants here is "somewhere on a coast",
 * so the landmass is generated deterministically from the name. The same place
 * always draws the same shape, which is what makes it feel like a map.
 */
function hashOf(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

type Geometry = { land: string; pin: { x: number; y: number } };

function geometryFor(place: string, w: number, h: number): Geometry {
  const random = makeRandom(hashOf(place));
  const corner = Math.floor(random() * 4);

  // A ragged coastline cutting the tile corner to corner.
  const steps = 7;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const jitter = (random() - 0.5) * 0.26;
    const x = (1 - t) * 0.96 + jitter * (i === 0 || i === steps ? 0 : 1);
    const y = t * 0.96 + jitter * (i === 0 || i === steps ? 0 : 1);
    points.push([Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]);
  }

  // Rotate the whole shape into one of the four corners.
  const place01 = ([x, y]: [number, number]): [number, number] => {
    switch (corner) {
      case 1:
        return [1 - x, y];
      case 2:
        return [x, 1 - y];
      case 3:
        return [1 - x, 1 - y];
      default:
        return [x, y];
    }
  };
  const origin = place01([0, 0]);

  const segments = points.map(place01).map(([x, y]) => `L ${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`);
  const land = `M ${(origin[0] * w).toFixed(1)} ${(origin[1] * h).toFixed(1)} ${segments.join(' ')} Z`;

  const pin = place01([0.3 + random() * 0.2, 0.3 + random() * 0.2]);
  return { land, pin: { x: pin[0] * w, y: pin[1] * h } };
}

export function PlaceTile({
  place,
  width = 120,
  height = 120,
  label = true,
  style,
}: {
  place: string;
  width?: number;
  height?: number;
  label?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const geometry = useMemo(() => geometryFor(place, width, height), [height, place, width]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={place}
      style={[
        {
          width,
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
          backgroundColor: theme.colors.placeBg,
        },
        style,
      ]}>
      <Svg width={width} height={height}>
        <Rect width={width} height={height} fill={theme.colors.placeBg} />
        <Path d={geometry.land} fill={theme.colors.placeLand} />
        <Circle cx={geometry.pin.x} cy={geometry.pin.y} r={Math.max(3, width * 0.035)} fill={theme.colors.placePin} />
      </Svg>
      {label ? (
        <View style={{ position: 'absolute', left: 8, bottom: 6 }}>
          <AppText variant="nameSM" style={{ color: theme.colors.placePin, letterSpacing: 0.8 }} numberOfLines={1}>
            {place}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
