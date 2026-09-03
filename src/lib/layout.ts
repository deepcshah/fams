/**
 * Family-tree layout.
 *
 * The tree is drawn as generation rows. People who are partners are grouped
 * into a "unit" and drawn side by side; a unit is positioned by centring it
 * over its children, falling back to the next free slot in its row. This is a
 * Reingold–Tilford style pass adapted for the fact that a family tree is a DAG
 * (two parents per child, people who marry into the family) rather than a tree.
 *
 * The module is pure and free of runtime imports so it can be unit tested and
 * reasoned about on its own.
 */

import type { Person, Union } from '../types';

export const NODE_W = 186;
export const NODE_H = 96;
/** Gap between two partners inside the same unit. */
export const COUPLE_GAP = 16;
/** Gap between neighbouring units in the same generation row. */
export const UNIT_GAP = 34;
/** Vertical gap between generation rows. */
export const ROW_GAP = 84;
export const ROW_H = NODE_H + ROW_GAP;

export type LayoutNode = {
  personId: string;
  unitId: string;
  generation: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Index of this person within their unit, left to right. */
  slot: number;
};

export type LayoutUnit = {
  id: string;
  memberIds: string[];
  generation: number;
  x: number;
  y: number;
  width: number;
  /** Direct children of this couple that are drawn on the canvas. */
  childIds: string[];
  /** Descendants hidden because this unit is collapsed. */
  hiddenDescendants: number;
  collapsed: boolean;
  /** Y of the horizontal sibling bar below this couple. */
  busY: number;
};

export type PartnerLink = {
  id: string;
  kind: 'partner';
  unionKey?: string;
  status?: Union['status'];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type DescentLink = {
  id: string;
  kind: 'descent';
  parentUnitId: string;
  childId: string;
  path: string;
};

export type TreeLayout = {
  nodes: LayoutNode[];
  units: LayoutUnit[];
  partnerLinks: PartnerLink[];
  descentLinks: DescentLink[];
  nodeById: Record<string, LayoutNode>;
  unitById: Record<string, LayoutUnit>;
  unitOfPerson: Record<string, string>;
  generations: Record<string, number>;
  /** Inclusive bounds of all drawn cards, before padding. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  generationRows: { generation: number; y: number }[];
};

export type LayoutOptions = {
  /** Unit ids whose descendants should be hidden. */
  collapsedUnitIds?: ReadonlySet<string>;
  unions?: Record<string, Union>;
  /** Ordering hint: people sorted earlier are laid out further left. */
  sortKey?: (person: Person) => number;
};

const MAX_GENERATION_PASSES = 64;

function unionKeyOf(a: string, b: string): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

function birthSortKey(person: Person): number {
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(person.birthDate ?? '');
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 10000 + Number(match[2] ?? 1) * 100 + Number(match[3] ?? 1);
}

function displayName(person: Person): string {
  return `${person.firstName} ${person.lastName ?? ''}`.trim().toLowerCase();
}

/**
 * Longest-path generation numbering: a person sits one row below their
 * deepest parent, and partners are pulled down to share a row. Both rules only
 * ever increase a generation, so the fixed-point loop terminates.
 */
export function computeGenerations(people: Person[]): Record<string, number> {
  const present = new Set(people.map((p) => p.id));
  const generations: Record<string, number> = {};
  for (const person of people) generations[person.id] = 0;

  for (let pass = 0; pass < MAX_GENERATION_PASSES; pass += 1) {
    let changed = false;

    for (const person of people) {
      let lowest = 0;
      for (const parentId of person.parentIds) {
        if (!present.has(parentId)) continue;
        lowest = Math.max(lowest, generations[parentId] + 1);
      }
      if (lowest > generations[person.id]) {
        generations[person.id] = lowest;
        changed = true;
      }
    }

    for (const person of people) {
      for (const partnerId of person.partnerIds) {
        if (!present.has(partnerId)) continue;
        const shared = Math.max(generations[person.id], generations[partnerId]);
        if (generations[person.id] < shared) {
          generations[person.id] = shared;
          changed = true;
        }
        if (generations[partnerId] < shared) {
          generations[partnerId] = shared;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return generations;
}

type Unit = {
  id: string;
  memberIds: string[];
  generation: number;
};

/**
 * Groups people into couples. A person joins the unit of the first partner who
 * claims them, so everybody is drawn exactly once even in tangled trees.
 */
function buildUnits(
  ordered: Person[],
  byId: Map<string, Person>,
  generations: Record<string, number>,
): { units: Unit[]; unitOfPerson: Record<string, string> } {
  const unitOfPerson: Record<string, string> = {};
  const units: Unit[] = [];

  for (const person of ordered) {
    if (unitOfPerson[person.id]) continue;
    const members: Person[] = [person];
    for (const partnerId of person.partnerIds) {
      if (unitOfPerson[partnerId]) continue;
      const partner = byId.get(partnerId);
      if (!partner) continue;
      if (generations[partnerId] !== generations[person.id]) continue;
      if (members.some((m) => m.id === partnerId)) continue;
      members.push(partner);
    }
    members.sort((a, b) => {
      const delta = birthSortKey(a) - birthSortKey(b);
      if (delta !== 0 && Number.isFinite(delta)) return delta;
      return displayName(a).localeCompare(displayName(b));
    });
    const unit: Unit = {
      id: `u_${person.id}`,
      memberIds: members.map((m) => m.id),
      generation: generations[person.id],
    };
    for (const member of members) unitOfPerson[member.id] = unit.id;
    units.push(unit);
  }

  return { units, unitOfPerson };
}

function unitWidth(unit: Unit): number {
  return unit.memberIds.length * NODE_W + (unit.memberIds.length - 1) * COUPLE_GAP;
}

/** Rounded elbow from a couple's drop point down to one child's top edge. */
function elbowPath(fromX: number, fromY: number, busY: number, toX: number, toY: number): string {
  if (Math.abs(toX - fromX) < 0.5) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }
  const dir = toX > fromX ? 1 : -1;
  const r = Math.min(14, Math.abs(toX - fromX) / 2, Math.abs(busY - fromY), Math.abs(toY - busY));
  return [
    `M ${fromX} ${fromY}`,
    `L ${fromX} ${busY - r}`,
    `Q ${fromX} ${busY} ${fromX + dir * r} ${busY}`,
    `L ${toX - dir * r} ${busY}`,
    `Q ${toX} ${busY} ${toX} ${busY + r}`,
    `L ${toX} ${toY}`,
  ].join(' ');
}

export function layoutFamilyTree(people: Person[], options: LayoutOptions = {}): TreeLayout {
  const collapsed = options.collapsedUnitIds ?? new Set<string>();
  const unions = options.unions ?? {};
  const byId = new Map(people.map((p) => [p.id, p]));
  const generations = computeGenerations(people);

  const rank = options.sortKey ?? birthSortKey;
  const ordered = [...people].sort((a, b) => {
    const genDelta = generations[a.id] - generations[b.id];
    if (genDelta !== 0) return genDelta;
    const keyDelta = rank(a) - rank(b);
    if (keyDelta !== 0 && Number.isFinite(keyDelta)) return keyDelta;
    return displayName(a).localeCompare(displayName(b));
  });

  const { units, unitOfPerson } = buildUnits(ordered, byId, generations);
  const unitById = new Map(units.map((u) => [u.id, u]));

  // Children of each unit, as child units, in a stable left-to-right order.
  const childrenOfPerson = new Map<string, string[]>();
  for (const person of ordered) {
    for (const parentId of person.parentIds) {
      if (!byId.has(parentId)) continue;
      const list = childrenOfPerson.get(parentId);
      if (list) list.push(person.id);
      else childrenOfPerson.set(parentId, [person.id]);
    }
  }

  const childUnitsOf = new Map<string, string[]>();
  const childPeopleOf = new Map<string, string[]>();
  for (const unit of units) {
    const seenUnits = new Set<string>();
    const childUnits: string[] = [];
    const childPeople: string[] = [];
    for (const memberId of unit.memberIds) {
      for (const childId of childrenOfPerson.get(memberId) ?? []) {
        if (childPeople.includes(childId)) continue;
        childPeople.push(childId);
        const childUnitId = unitOfPerson[childId];
        if (!childUnitId || childUnitId === unit.id || seenUnits.has(childUnitId)) continue;
        seenUnits.add(childUnitId);
        childUnits.push(childUnitId);
      }
    }
    childPeople.sort((a, b) => {
      const pa = byId.get(a);
      const pb = byId.get(b);
      if (!pa || !pb) return 0;
      const delta = rank(pa) - rank(pb);
      if (delta !== 0 && Number.isFinite(delta)) return delta;
      return displayName(pa).localeCompare(displayName(pb));
    });
    // Order child units by the position of their earliest blood child.
    const unitRank = new Map<string, number>();
    childPeople.forEach((childId, index) => {
      const childUnitId = unitOfPerson[childId];
      if (childUnitId && !unitRank.has(childUnitId)) unitRank.set(childUnitId, index);
    });
    childUnits.sort((a, b) => (unitRank.get(a) ?? 0) - (unitRank.get(b) ?? 0));
    childUnitsOf.set(unit.id, childUnits);
    childPeopleOf.set(unit.id, childPeople);
  }

  // Units that are somebody's child unit are not roots.
  const hasParentUnit = new Set<string>();
  for (const unit of units) {
    for (const childUnitId of childUnitsOf.get(unit.id) ?? []) hasParentUnit.add(childUnitId);
  }

  const positions = new Map<string, { x: number; generation: number }>();
  const placed = new Set<string>();
  const cursor = new Map<number, number>();

  function cursorAt(generation: number): number {
    return cursor.get(generation) ?? 0;
  }

  function centerOf(unitId: string): number {
    const pos = positions.get(unitId);
    const unit = unitById.get(unitId);
    if (!pos || !unit) return 0;
    return pos.x + unitWidth(unit) / 2;
  }

  function shiftSubtree(unitIds: string[], dx: number) {
    if (dx === 0) return;
    for (const unitId of unitIds) {
      const pos = positions.get(unitId);
      const unit = unitById.get(unitId);
      if (!pos || !unit) continue;
      pos.x += dx;
      cursor.set(pos.generation, Math.max(cursorAt(pos.generation), pos.x + unitWidth(unit) + UNIT_GAP));
    }
  }

  function place(unitId: string): string[] | null {
    if (placed.has(unitId) || hiddenUnits.has(unitId)) return null;
    const unit = unitById.get(unitId);
    if (!unit) return null;
    placed.add(unitId);

    const generation = unit.generation;
    const width = unitWidth(unit);
    const subtree: string[] = [unitId];
    let x: number;

    const childUnits = collapsed.has(unitId) ? [] : (childUnitsOf.get(unitId) ?? []);
    const placedChildren: string[] = [];
    for (const childUnitId of childUnits) {
      const result = place(childUnitId);
      if (result) {
        placedChildren.push(childUnitId);
        subtree.push(...result);
      }
    }

    if (placedChildren.length === 0) {
      x = cursorAt(generation);
    } else {
      const first = centerOf(placedChildren[0]);
      const last = centerOf(placedChildren[placedChildren.length - 1]);
      x = (first + last) / 2 - width / 2;
      const min = cursorAt(generation);
      if (x < min) {
        // Rather than overlap a sibling, push the whole child block right so the
        // parents stay centred over their children.
        shiftSubtree(subtree.slice(1), min - x);
        x = min;
      }
    }

    positions.set(unitId, { x, generation });
    cursor.set(generation, Math.max(cursorAt(generation), x + width + UNIT_GAP));
    return subtree;
  }

  const roots = units
    .filter((u) => !hasParentUnit.has(u.id))
    .sort((a, b) => {
      const genDelta = a.generation - b.generation;
      if (genDelta !== 0) return genDelta;
      return ordered.findIndex((p) => p.id === a.memberIds[0]) - ordered.findIndex((p) => p.id === b.memberIds[0]);
    });

  // A collapsed couple only really hides the descendants that cannot be reached
  // any other way. Somebody who married into the family still appears if their
  // own parents are on the canvas, so the "N hidden" badge counts what actually
  // disappeared rather than the whole subtree.
  const openReachable = new Set<string>();
  const reachStack = roots.map((root) => root.id);
  while (reachStack.length > 0) {
    const unitId = reachStack.pop()!;
    if (openReachable.has(unitId)) continue;
    openReachable.add(unitId);
    if (collapsed.has(unitId)) continue;
    for (const childUnitId of childUnitsOf.get(unitId) ?? []) reachStack.push(childUnitId);
  }

  function descendantUnitsOf(unitId: string): Set<string> {
    const seen = new Set<string>();
    const stack = [...(childUnitsOf.get(unitId) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const childUnitId of childUnitsOf.get(current) ?? []) stack.push(childUnitId);
    }
    return seen;
  }

  const hiddenUnits = new Set<string>();
  const hiddenCountByUnit = new Map<string, number>();
  for (const collapsedId of collapsed) {
    if (!unitById.has(collapsedId)) continue;
    let hiddenPeople = 0;
    for (const descendantId of descendantUnitsOf(collapsedId)) {
      if (openReachable.has(descendantId)) continue;
      hiddenUnits.add(descendantId);
      hiddenPeople += unitById.get(descendantId)?.memberIds.length ?? 0;
    }
    hiddenCountByUnit.set(collapsedId, hiddenPeople);
  }

  for (const root of roots) place(root.id);
  // Anything left is part of a cycle or an orphaned couple; give it a slot too.
  for (const unit of units) place(unit.id);

  const layoutUnits: LayoutUnit[] = [];
  const nodes: LayoutNode[] = [];
  const nodeById: Record<string, LayoutNode> = {};
  const unitByIdOut: Record<string, LayoutUnit> = {};

  for (const unit of units) {
    const pos = positions.get(unit.id);
    if (!pos) continue;
    const y = pos.generation * ROW_H;
    const isCollapsed = collapsed.has(unit.id) && (hiddenCountByUnit.get(unit.id) ?? 0) > 0;
    const layoutUnit: LayoutUnit = {
      id: unit.id,
      memberIds: unit.memberIds,
      generation: pos.generation,
      x: pos.x,
      y,
      width: unitWidth(unit),
      childIds: isCollapsed ? [] : (childPeopleOf.get(unit.id) ?? []),
      hiddenDescendants: isCollapsed ? (hiddenCountByUnit.get(unit.id) ?? 0) : 0,
      collapsed: isCollapsed,
      busY: 0,
    };
    layoutUnits.push(layoutUnit);
    unitByIdOut[unit.id] = layoutUnit;

    unit.memberIds.forEach((personId, slot) => {
      const node: LayoutNode = {
        personId,
        unitId: unit.id,
        generation: pos.generation,
        x: pos.x + slot * (NODE_W + COUPLE_GAP),
        y,
        width: NODE_W,
        height: NODE_H,
        slot,
      };
      nodes.push(node);
      nodeById[personId] = node;
    });
  }

  // Links.
  const partnerLinks: PartnerLink[] = [];
  for (const unit of layoutUnits) {
    for (let i = 0; i < unit.memberIds.length - 1; i += 1) {
      const a = nodeById[unit.memberIds[i]];
      const b = nodeById[unit.memberIds[i + 1]];
      if (!a || !b) continue;
      const key = unionKeyOf(a.personId, b.personId);
      partnerLinks.push({
        id: `pl_${key}`,
        kind: 'partner',
        unionKey: key,
        status: unions[key]?.status,
        x1: a.x + a.width,
        y1: a.y + a.height / 2,
        x2: b.x,
        y2: b.y + b.height / 2,
      });
    }
  }

  // Neighbouring couples in the same row would otherwise draw their sibling
  // bars at identical heights and merge into one long line, so the bars are
  // staggered across three lanes in left-to-right order.
  const laneByUnit = new Map<string, number>();
  const rowsOfUnits = new Map<number, LayoutUnit[]>();
  for (const unit of layoutUnits) {
    const row = rowsOfUnits.get(unit.generation);
    if (row) row.push(unit);
    else rowsOfUnits.set(unit.generation, [unit]);
  }
  for (const row of rowsOfUnits.values()) {
    row
      .filter((unit) => unit.childIds.length > 0)
      .sort((a, b) => a.x - b.x)
      .forEach((unit, index) => laneByUnit.set(unit.id, index % 3));
  }

  const descentLinks: DescentLink[] = [];
  for (const unit of layoutUnits) {
    if (unit.childIds.length === 0) continue;
    const anchorX = unit.x + unit.width / 2;
    const anchorY = unit.y + NODE_H;
    const busY = anchorY + ROW_GAP * (0.34 + 0.13 * (laneByUnit.get(unit.id) ?? 0));
    unit.busY = busY;
    for (const childId of unit.childIds) {
      const child = nodeById[childId];
      if (!child) continue;
      descentLinks.push({
        id: `dl_${unit.id}_${childId}`,
        kind: 'descent',
        parentUnitId: unit.id,
        childId,
        path: elbowPath(anchorX, anchorY, busY, child.x + child.width / 2, child.y),
      });
    }
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  if (nodes.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const generationRows = [...new Set(layoutUnits.map((u) => u.generation))]
    .sort((a, b) => a - b)
    .map((generation) => ({ generation, y: generation * ROW_H }));

  return {
    nodes,
    units: layoutUnits,
    partnerLinks,
    descentLinks,
    nodeById,
    unitById: unitByIdOut,
    unitOfPerson,
    generations,
    bounds: { minX, minY, maxX, maxY },
    width: maxX - minX,
    height: maxY - minY,
    generationRows,
  };
}
