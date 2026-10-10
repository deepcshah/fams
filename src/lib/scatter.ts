/**
 * Scatter layout for a person's life canvas.
 *
 * Photographs and places are strewn around a central portrait the way they
 * would be on a table, but the result has to be stable (the same person always
 * gets the same arrangement) and overlap-free. Items are tried along a golden
 * spiral at growing radii and the first non-colliding slot wins.
 *
 * Pure, with no runtime imports, so it can be unit tested on its own.
 */

export type ScatterItem = { id: string; width: number; height: number };
export type Placement = { id: string; x: number; y: number; width: number; height: number };
export type ScatterResult = {
  placements: Placement[];
  byId: Record<string, Placement>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
};

export type ScatterOptions = {
  /** Clear space kept between any two items. */
  gap?: number;
  /** Horizontal stretch; a canvas reads better wide than square. */
  aspect?: number;
  seed?: number;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

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

function overlaps(a: Placement, b: Placement, gap: number): boolean {
  return (
    a.x - gap < b.x + b.width &&
    a.x + a.width + gap > b.x &&
    a.y - gap < b.y + b.height &&
    a.y + a.height + gap > b.y
  );
}

export function scatterLayout(
  hero: ScatterItem,
  items: ScatterItem[],
  options: ScatterOptions = {},
): ScatterResult {
  const gap = options.gap ?? 26;
  const aspect = options.aspect ?? 1.3;

  const placements: Placement[] = [
    { id: hero.id, x: -hero.width / 2, y: -hero.height / 2, width: hero.width, height: hero.height },
  ];

  const heroRadius = Math.max(hero.width, hero.height) / 2;
  const step = 30;

  items.forEach((item, index) => {
    const random = makeRandom(hashOf(item.id) ^ ((options.seed ?? 0) + index));
    let placed: Placement | null = null;

    for (let ring = 0; ring < 60 && !placed; ring += 1) {
      const radius = heroRadius + gap + ring * step;
      for (let attempt = 0; attempt < 14 && !placed; attempt += 1) {
        const angle = GOLDEN_ANGLE * (index + 1) + attempt * 0.52 + (random() - 0.5) * 0.35;
        const candidate: Placement = {
          id: item.id,
          x: Math.cos(angle) * radius * aspect - item.width / 2,
          y: Math.sin(angle) * radius - item.height / 2,
          width: item.width,
          height: item.height,
        };
        if (!placements.some((other) => overlaps(candidate, other, gap))) placed = candidate;
      }
    }

    // Still nowhere to go: park it beyond everything placed so far.
    placements.push(
      placed ?? {
        id: item.id,
        x: Math.max(...placements.map((p) => p.x + p.width)) + gap,
        y: -item.height / 2,
        width: item.width,
        height: item.height,
      },
    );
  });

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of placements) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }
  if (placements.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const byId: Record<string, Placement> = {};
  for (const p of placements) byId[p.id] = p;

  return {
    placements,
    byId,
    bounds: { minX, minY, maxX, maxY },
    width: maxX - minX,
    height: maxY - minY,
  };
}
