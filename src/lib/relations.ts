/**
 * Derived views over the raw people graph: immediate family, lineage filters,
 * kinship naming and tree-wide statistics. Pure, no runtime imports.
 */

import type { Person } from '../types';

export type PeopleMap = Record<string, Person>;

export function fullName(person: Person | undefined | null): string {
  if (!person) return 'Unknown';
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Unnamed';
}

export function initialsOf(person: Person | undefined | null): string {
  if (!person) return '?';
  const first = person.firstName?.trim()?.[0] ?? '';
  const last = person.lastName?.trim()?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

export function childrenOf(people: PeopleMap, personId: string): Person[] {
  return Object.values(people).filter((p) => p.parentIds.includes(personId));
}

export function parentsOf(people: PeopleMap, personId: string): Person[] {
  const person = people[personId];
  if (!person) return [];
  return person.parentIds.map((id) => people[id]).filter(Boolean);
}

export function partnersOf(people: PeopleMap, personId: string): Person[] {
  const person = people[personId];
  if (!person) return [];
  return person.partnerIds.map((id) => people[id]).filter(Boolean);
}

/** Anyone sharing at least one parent. */
export function siblingsOf(people: PeopleMap, personId: string): Person[] {
  const person = people[personId];
  if (!person || person.parentIds.length === 0) return [];
  const parentIds = new Set(person.parentIds);
  return Object.values(people).filter(
    (p) => p.id !== personId && p.parentIds.some((id) => parentIds.has(id)),
  );
}

export function ancestorsOf(people: PeopleMap, personId: string, maxDepth = Infinity): Set<string> {
  const result = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: personId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const parentId of people[id]?.parentIds ?? []) {
      if (!people[parentId] || result.has(parentId)) continue;
      result.add(parentId);
      queue.push({ id: parentId, depth: depth + 1 });
    }
  }
  return result;
}

export function descendantsOf(people: PeopleMap, personId: string, maxDepth = Infinity): Set<string> {
  const childIndex = buildChildIndex(people);
  const result = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: personId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const childId of childIndex.get(id) ?? []) {
      if (result.has(childId)) continue;
      result.add(childId);
      queue.push({ id: childId, depth: depth + 1 });
    }
  }
  return result;
}

export function buildChildIndex(people: PeopleMap): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const person of Object.values(people)) {
    for (const parentId of person.parentIds) {
      const list = index.get(parentId);
      if (list) list.push(person.id);
      else index.set(parentId, [person.id]);
    }
  }
  return index;
}

/**
 * The subset of the tree that is "about" one person: their ancestors, their
 * descendants, the siblings along the way, and everybody's partners. Used by
 * the canvas' focus mode to cut a large tree down to a readable branch.
 */
export function lineageOf(people: PeopleMap, personId: string): Set<string> {
  if (!people[personId]) return new Set();
  const childIndex = buildChildIndex(people);
  const keep = new Set<string>([personId]);

  const ancestors = ancestorsOf(people, personId);
  for (const id of ancestors) keep.add(id);

  // Siblings of the focus person and of every ancestor (aunts, uncles, cousins).
  for (const id of [personId, ...ancestors]) {
    for (const sibling of siblingsOf(people, id)) keep.add(sibling.id);
  }

  const seeds = [...keep];
  for (const id of seeds) {
    for (const descendantId of descendantsOf(people, id)) keep.add(descendantId);
  }

  for (const id of [...keep]) {
    for (const partnerId of people[id]?.partnerIds ?? []) {
      if (people[partnerId]) keep.add(partnerId);
    }
  }

  // Keep both parents of anyone in the set so couples are not split apart.
  for (const id of [...keep]) {
    for (const parentId of people[id]?.parentIds ?? []) {
      if (!people[parentId]) continue;
      const partnerInSet = (people[parentId].partnerIds ?? []).some((pid) => keep.has(pid));
      if (partnerInSet) keep.add(parentId);
    }
  }

  void childIndex;
  return keep;
}

/** Returns copies with every reference outside `ids` stripped. */
export function subsetPeople(people: PeopleMap, ids: ReadonlySet<string>): Person[] {
  return [...ids]
    .map((id) => people[id])
    .filter(Boolean)
    .map((person) => ({
      ...person,
      parentIds: person.parentIds.filter((pid) => ids.has(pid)),
      partnerIds: person.partnerIds.filter((pid) => ids.has(pid)),
    }));
}

/** Steps up from `fromId` to the nearest common ancestor with `toId`. */
function distanceToAncestor(people: PeopleMap, fromId: string, ancestorId: string): number | null {
  if (fromId === ancestorId) return 0;
  const visited = new Set<string>([fromId]);
  let frontier = [fromId];
  let depth = 0;
  while (frontier.length > 0 && depth < 64) {
    depth += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const parentId of people[id]?.parentIds ?? []) {
        if (parentId === ancestorId) return depth;
        if (visited.has(parentId)) continue;
        visited.add(parentId);
        next.push(parentId);
      }
    }
    frontier = next;
  }
  return null;
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function greatPrefix(steps: number, base: string): string {
  if (steps <= 0) return base;
  if (steps === 1) return `grand${base}`;
  return `${'great-'.repeat(steps - 1)}grand${base}`;
}

/**
 * The blood relationship from `personId` to `otherId`, or null when they are
 * only connected by marriage (or not at all).
 */
function bloodKinship(people: PeopleMap, personId: string, otherId: string): string | null {
  const self = people[personId];
  const other = people[otherId];
  if (!self || !other) return null;

  const feminine = other.gender === 'female';
  const masculine = other.gender === 'male';
  const pick = (f: string, m: string, n: string) => (feminine ? f : masculine ? m : n);

  if (self.parentIds.includes(otherId)) return pick('mother', 'father', 'parent');
  if (other.parentIds.includes(personId)) return pick('daughter', 'son', 'child');

  const upFromSelf = distanceToAncestor(people, personId, otherId);
  if (upFromSelf !== null && upFromSelf > 0) {
    return greatPrefix(upFromSelf - 1, pick('mother', 'father', 'parent'));
  }
  const downToOther = distanceToAncestor(people, otherId, personId);
  if (downToOther !== null && downToOther > 0) {
    return greatPrefix(downToOther - 1, pick('daughter', 'son', 'child'));
  }

  // Collateral relatives, found through the nearest common ancestor.
  const selfAncestors = ancestorsOf(people, personId);
  const otherAncestors = ancestorsOf(people, otherId);
  let best: { a: number; b: number } | null = null;
  for (const candidate of selfAncestors) {
    if (!otherAncestors.has(candidate)) continue;
    const a = distanceToAncestor(people, personId, candidate);
    const b = distanceToAncestor(people, otherId, candidate);
    if (a === null || b === null) continue;
    if (!best || a + b < best.a + best.b) best = { a, b };
  }
  if (!best) return null;

  const { a, b } = best;
  if (a === 1 && b === 1) return pick('sister', 'brother', 'sibling');
  if (a === 1) return greatPrefix(b - 2, pick('niece', 'nephew', 'nibling'));
  if (b === 1) return greatPrefix(a - 2, pick('aunt', 'uncle', 'aunt or uncle'));

  const degree = Math.min(a, b) - 1;
  const removed = Math.abs(a - b);
  const base = degree === 1 ? 'cousin' : `${ordinal(degree)} cousin`;
  if (removed === 0) return base;
  if (removed === 1) return `${base} once removed`;
  if (removed === 2) return `${base} twice removed`;
  return `${base} ${removed}\u00D7 removed`;
}

/**
 * A human label for how `otherId` relates to `personId` — "grandmother",
 * "2nd cousin once removed", "sister-in-law". Best effort; returns "relative"
 * when the link is real but has no tidy English name.
 */
export function kinshipLabel(people: PeopleMap, personId: string, otherId: string): string {
  if (personId === otherId) return 'you';
  const self = people[personId];
  const other = people[otherId];
  if (!self || !other) return 'relative';

  const feminine = other.gender === 'female';
  const masculine = other.gender === 'male';
  const pick = (f: string, m: string, n: string) => (feminine ? f : masculine ? m : n);

  if (self.partnerIds.includes(otherId)) return pick('wife', 'husband', 'partner');

  const blood = bloodKinship(people, personId, otherId);
  if (blood) return blood;

  // Related through somebody `other` is partnered with.
  for (const partnerId of other.partnerIds) {
    const label = bloodKinship(people, personId, partnerId);
    if (!label) continue;
    if (/sister|brother|sibling/.test(label)) return `${pick('sister', 'brother', 'sibling')}-in-law`;
    // The spouse of an aunt is an uncle, keeping any great-/grand- prefix.
    const auntOrUncle = /^(.*?)(aunt or uncle|aunt|uncle)$/.exec(label);
    if (auntOrUncle) return `${auntOrUncle[1]}${pick('aunt', 'uncle', 'aunt or uncle')}`;
    if (/daughter|son|child/.test(label) && !/grand/.test(label)) return `${pick('daughter', 'son', 'child')}-in-law`;
    if (/^(mother|father|parent)$/.test(label)) return `step-${pick('mother', 'father', 'parent')}`;
    return `${label}\u2019s ${pick('wife', 'husband', 'partner')}`;
  }

  // Related through somebody `self` is partnered with.
  for (const partnerId of self.partnerIds) {
    const label = bloodKinship(people, partnerId, otherId);
    if (!label) continue;
    if (/^(mother|father|parent)$/.test(label)) return `${pick('mother', 'father', 'parent')}-in-law`;
    if (/sister|brother|sibling/.test(label)) return `${pick('sister', 'brother', 'sibling')}-in-law`;
    return `${pick('wife', 'husband', 'partner')}\u2019s ${label}`;
  }

  return 'relative';
}

export type TreeStats = {
  total: number;
  living: number;
  deceased: number;
  generations: number;
  couples: number;
  surnames: { name: string; count: number }[];
  oldestLiving?: { person: Person; age: number };
  longestLife?: { person: Person; age: number };
  averageChildren: number;
  earliestBirthYear?: number;
};

export function computeStats(
  people: PeopleMap,
  generations: Record<string, number>,
  ageFor: (person: Person) => number | null,
): TreeStats {
  const all = Object.values(people);
  const deceased = all.filter((p) => p.deceased || Boolean(p.deathDate));
  const childIndex = buildChildIndex(people);

  const surnameCounts = new Map<string, number>();
  for (const person of all) {
    const name = (person.lastName ?? '').trim();
    if (!name) continue;
    surnameCounts.set(name, (surnameCounts.get(name) ?? 0) + 1);
  }

  const couples = new Set<string>();
  for (const person of all) {
    for (const partnerId of person.partnerIds) {
      if (!people[partnerId]) continue;
      couples.add(person.id < partnerId ? `${person.id}~${partnerId}` : `${partnerId}~${person.id}`);
    }
  }

  let oldestLiving: TreeStats['oldestLiving'];
  let longestLife: TreeStats['longestLife'];
  for (const person of all) {
    const age = ageFor(person);
    if (age === null) continue;
    if (person.deathDate || person.deceased) {
      if (!longestLife || age > longestLife.age) longestLife = { person, age };
    } else if (!oldestLiving || age > oldestLiving.age) {
      oldestLiving = { person, age };
    }
  }

  const parentsWithChildren = all.filter((p) => (childIndex.get(p.id) ?? []).length > 0);
  const totalChildren = parentsWithChildren.reduce((sum, p) => sum + (childIndex.get(p.id) ?? []).length, 0);

  const years = all
    .map((p) => Number(/^(\d{4})/.exec(p.birthDate ?? '')?.[1]))
    .filter((y) => Number.isFinite(y));

  const generationValues = Object.values(generations);

  return {
    total: all.length,
    living: all.length - deceased.length,
    deceased: deceased.length,
    generations: generationValues.length > 0 ? Math.max(...generationValues) + 1 : 0,
    couples: couples.size,
    surnames: [...surnameCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    oldestLiving,
    longestLife,
    averageChildren: parentsWithChildren.length > 0 ? totalChildren / parentsWithChildren.length : 0,
    earliestBirthYear: years.length > 0 ? Math.min(...years) : undefined,
  };
}

/** Case- and accent-insensitive scoring for the people search. */
export function matchScore(person: Person, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const haystacks: [string, number][] = [
    [fullName(person).toLowerCase(), 10],
    [(person.nickname ?? '').toLowerCase(), 8],
    [(person.birthName ?? '').toLowerCase(), 6],
    [(person.birthPlace ?? '').toLowerCase(), 3],
    [(person.occupation ?? '').toLowerCase(), 3],
  ];
  let best = 0;
  for (const [text, weight] of haystacks) {
    if (!text) continue;
    if (text === q) best = Math.max(best, weight * 3);
    else if (text.startsWith(q)) best = Math.max(best, weight * 2);
    else if (text.includes(q)) best = Math.max(best, weight);
  }
  return best;
}
