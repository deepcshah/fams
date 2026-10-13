/**
 * Merging a local tree with the copy on the server.
 *
 * Two people editing the same family from two devices is the normal case, so
 * this has to converge without a server round-trip per keystroke. The rule is
 * last-write-wins per record, using each record's own `updatedAt`, with
 * tombstones so a deletion is not silently undone by the other side still
 * holding the record.
 *
 * It is deliberately not a CRDT: concurrent edits to the *same* person lose the
 * older one entirely rather than merging field by field. For a family tree that
 * is an honest trade — two people rarely retype the same birth date at once,
 * and a predictable rule beats a clever one nobody can reason about.
 *
 * Pure, with no runtime imports, so it can be unit tested on its own.
 */

import type { FamilyTree, Person, Union } from '../types';

/** id (person id or union key) → when it was deleted. */
export type Tombstones = Record<string, number>;

export type MergeSide = {
  tree: FamilyTree;
  tombstones: Tombstones;
  /** When the tree's own fields (name, home person) last changed. */
  updatedAt: number;
};

export type MergeResult = {
  tree: FamilyTree;
  tombstones: Tombstones;
  updatedAt: number;
  /** What the local side must now send upward. */
  push: { personIds: string[]; unionKeys: string[]; tombstones: string[] };
  /** Records the remote copy replaced, worth telling the user about. */
  overwritten: string[];
};

function stampOf(record: { updatedAt?: number }): number {
  return typeof record.updatedAt === 'number' ? record.updatedAt : 0;
}

/**
 * Drops references to people who are no longer present and partnerships whose
 * partners have gone, and makes every partnership symmetric. A merge can leave
 * dangling edges whenever one side deleted somebody the other still links to.
 */
export function reconcileTree(tree: FamilyTree): FamilyTree {
  const people: Record<string, Person> = {};
  for (const [id, person] of Object.entries(tree.people)) {
    people[id] = { ...person, parentIds: [...person.parentIds], partnerIds: [...person.partnerIds] };
  }

  for (const person of Object.values(people)) {
    person.parentIds = [...new Set(person.parentIds.filter((id) => id !== person.id && people[id]))].slice(0, 2);
    person.partnerIds = [...new Set(person.partnerIds.filter((id) => id !== person.id && people[id]))];
  }
  for (const person of Object.values(people)) {
    for (const partnerId of person.partnerIds) {
      if (!people[partnerId].partnerIds.includes(person.id)) people[partnerId].partnerIds.push(person.id);
    }
  }

  const unions: Record<string, Union> = {};
  for (const [key, union] of Object.entries(tree.unions)) {
    const [a, b] = union.partnerIds;
    if (!people[a] || !people[b]) continue;
    if (!people[a].partnerIds.includes(b)) continue;
    unions[key] = union;
  }
  // A partnership with no union record still needs one, or its status is lost.
  for (const person of Object.values(people)) {
    for (const partnerId of person.partnerIds) {
      const key = person.id < partnerId ? `${person.id}~${partnerId}` : `${partnerId}~${person.id}`;
      if (unions[key]) continue;
      unions[key] = { key, partnerIds: key.split('~') as [string, string], status: 'married' };
    }
  }

  const homeId = tree.homeId && people[tree.homeId] ? tree.homeId : undefined;
  return { name: tree.name, people, unions, homeId };
}

function mergeRecords<T extends { updatedAt?: number }>(
  local: Record<string, T>,
  remote: Record<string, T>,
  localTombs: Tombstones,
  remoteTombs: Tombstones,
  push: string[],
  overwritten: string[],
  labelOf: (record: T) => string,
): Record<string, T> {
  const merged: Record<string, T> = {};
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const id of ids) {
    const mine = local[id];
    const theirs = remote[id];
    const deletedHere = localTombs[id];
    const deletedThere = remoteTombs[id];

    // A deletion only sticks if nobody edited the record after it happened.
    if (deletedHere !== undefined && (!theirs || stampOf(theirs) <= deletedHere)) {
      if (theirs) push.push(id);
      continue;
    }
    if (deletedThere !== undefined && (!mine || stampOf(mine) <= deletedThere)) {
      continue;
    }

    if (mine && theirs) {
      if (stampOf(mine) > stampOf(theirs)) {
        merged[id] = mine;
        push.push(id);
      } else {
        merged[id] = theirs;
        if (stampOf(mine) < stampOf(theirs)) overwritten.push(labelOf(theirs));
      }
      continue;
    }
    if (mine) {
      merged[id] = mine;
      push.push(id);
    } else if (theirs) {
      merged[id] = theirs;
    }
  }

  return merged;
}

export function mergeTrees(local: MergeSide, remote: MergeSide): MergeResult {
  const personIds: string[] = [];
  const unionKeys: string[] = [];
  const overwritten: string[] = [];

  const people = mergeRecords(
    local.tree.people,
    remote.tree.people,
    local.tombstones,
    remote.tombstones,
    personIds,
    overwritten,
    (person) => [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Somebody',
  );
  const unions = mergeRecords(
    local.tree.unions,
    remote.tree.unions,
    local.tombstones,
    remote.tombstones,
    unionKeys,
    [],
    () => 'a partnership',
  );

  // Tree-level fields follow the same rule as a record.
  const localWins = local.updatedAt > remote.updatedAt;
  const header = localWins ? local.tree : remote.tree;

  const tombstones: Tombstones = { ...remote.tombstones };
  for (const [id, at] of Object.entries(local.tombstones)) {
    tombstones[id] = Math.max(at, tombstones[id] ?? 0);
  }
  // A record that came back to life is no longer deleted.
  for (const id of Object.keys(tombstones)) {
    if (people[id] || unions[id]) delete tombstones[id];
  }

  const pushTombstones = Object.keys(local.tombstones).filter((id) => tombstones[id] !== undefined);

  return {
    tree: reconcileTree({ name: header.name, people, unions, homeId: header.homeId }),
    tombstones,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    push: { personIds, unionKeys, tombstones: pushTombstones },
    overwritten: [...new Set(overwritten)],
  };
}
