import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeTrees, reconcileTree, type MergeSide } from '../src/lib/merge.ts';
import type { FamilyTree, Person } from '../src/types.ts';

function person(id: string, updatedAt: number, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: id,
    gender: 'other',
    parentIds: [],
    partnerIds: [],
    createdAt: 0,
    updatedAt,
    ...overrides,
  };
}

function tree(people: Person[], overrides: Partial<FamilyTree> = {}): FamilyTree {
  return {
    name: 'Family',
    people: Object.fromEntries(people.map((p) => [p.id, p])),
    unions: {},
    ...overrides,
  };
}

function side(t: FamilyTree, tombstones = {}, updatedAt = 0): MergeSide {
  return { tree: t, tombstones, updatedAt };
}

test('the newer edit of a person wins', () => {
  const local = side(tree([person('a', 200, { firstName: 'Local' })]));
  const remote = side(tree([person('a', 100, { firstName: 'Remote' })]));
  const result = mergeTrees(local, remote);
  assert.equal(result.tree.people.a.firstName, 'Local');
  assert.deepEqual(result.push.personIds, ['a']);
  assert.deepEqual(result.overwritten, []);
});

test('losing to the server is reported so it can be surfaced', () => {
  const local = side(tree([person('a', 100, { firstName: 'Mine', lastName: 'Hart' })]));
  const remote = side(tree([person('a', 200, { firstName: 'Theirs', lastName: 'Hart' })]));
  const result = mergeTrees(local, remote);
  assert.equal(result.tree.people.a.firstName, 'Theirs');
  assert.deepEqual(result.overwritten, ['Theirs Hart']);
  assert.deepEqual(result.push.personIds, []);
});

test('an exact tie resolves to the server, so both sides converge', () => {
  const local = side(tree([person('a', 100, { firstName: 'Local' })]));
  const remote = side(tree([person('a', 100, { firstName: 'Remote' })]));
  assert.equal(mergeTrees(local, remote).tree.people.a.firstName, 'Remote');
});

test('people added on either side survive', () => {
  const local = side(tree([person('a', 1), person('b', 1)]));
  const remote = side(tree([person('a', 1), person('c', 1)]));
  const result = mergeTrees(local, remote);
  assert.deepEqual(Object.keys(result.tree.people).sort(), ['a', 'b', 'c']);
  assert.deepEqual(result.push.personIds, ['b']);
});

test('a local deletion removes the record the server still holds', () => {
  const local = side(tree([person('a', 1)]), { b: 500 });
  const remote = side(tree([person('a', 1), person('b', 100)]));
  const result = mergeTrees(local, remote);
  assert.equal(result.tree.people.b, undefined);
  assert.ok(result.push.tombstones.includes('b'));
});

test('an edit made after a deletion brings the person back', () => {
  // Someone else kept working on a person this device had already deleted.
  const local = side(tree([person('a', 1)]), { b: 100 });
  const remote = side(tree([person('a', 1), person('b', 900, { firstName: 'Revived' })]));
  const result = mergeTrees(local, remote);
  assert.equal(result.tree.people.b.firstName, 'Revived');
  assert.equal(result.tombstones.b, undefined, 'the tombstone is cleared');
});

test('a remote deletion removes a stale local copy', () => {
  const local = side(tree([person('a', 1), person('b', 50)]));
  const remote = side(tree([person('a', 1)]), { b: 500 });
  const result = mergeTrees(local, remote);
  assert.equal(result.tree.people.b, undefined);
});

test('a local edit after a remote deletion keeps the person', () => {
  const local = side(tree([person('a', 1), person('b', 900, { firstName: 'Kept' })]));
  const remote = side(tree([person('a', 1)]), { b: 100 });
  const result = mergeTrees(local, remote);
  assert.equal(result.tree.people.b.firstName, 'Kept');
  assert.ok(result.push.personIds.includes('b'));
});

test('the tree name and home person follow the newer side', () => {
  const local = side(tree([person('a', 1)], { name: 'Local name', homeId: 'a' }), {}, 10);
  const remote = side(tree([person('a', 1)], { name: 'Remote name' }), {}, 20);
  const merged = mergeTrees(local, remote);
  assert.equal(merged.tree.name, 'Remote name');
  assert.equal(merged.tree.homeId, undefined);
  assert.equal(merged.updatedAt, 20);
});

test('merging is convergent: both devices reach the same tree', () => {
  const a = tree([person('x', 300, { firstName: 'X2' }), person('y', 100)]);
  const b = tree([person('x', 200, { firstName: 'X1' }), person('z', 100)]);
  const forward = mergeTrees(side(a, { q: 1 }), side(b, {}));
  const backward = mergeTrees(side(b, {}), side(a, { q: 1 }));
  assert.deepEqual(Object.keys(forward.tree.people).sort(), Object.keys(backward.tree.people).sort());
  assert.equal(forward.tree.people.x.firstName, 'X2');
  assert.equal(backward.tree.people.x.firstName, 'X2');
});

test('references to deleted people are dropped rather than left dangling', () => {
  const local = side(
    tree([person('parent', 1), person('child', 1, { parentIds: ['parent', 'ghost'] })]),
    { ghost: 900 },
  );
  // The server still holds the same links; only "ghost" is gone locally.
  const remote = side(
    tree([person('parent', 1), person('child', 1, { parentIds: ['parent', 'ghost'] }), person('ghost', 100)]),
  );
  const result = mergeTrees(local, remote);
  assert.equal(result.tree.people.ghost, undefined);
  assert.deepEqual(result.tree.people.child.parentIds, ['parent']);
});

test('reconcile makes partnerships symmetric and keeps their union', () => {
  const fixed = reconcileTree({
    name: 'F',
    people: {
      a: person('a', 1, { partnerIds: ['b'] }),
      b: person('b', 1),
    },
    unions: {},
  });
  assert.deepEqual(fixed.people.b.partnerIds, ['a']);
  assert.ok(fixed.unions['a~b'], 'a partnership without a union record gets one');
});

test('reconcile drops a union whose partner has gone', () => {
  const fixed = reconcileTree({
    name: 'F',
    people: { a: person('a', 1) },
    unions: { 'a~gone': { key: 'a~gone', partnerIds: ['a', 'gone'], status: 'married' } },
  });
  assert.deepEqual(Object.keys(fixed.unions), []);
});

test('reconcile caps parents at two and drops self-references', () => {
  const fixed = reconcileTree({
    name: 'F',
    people: {
      a: person('a', 1),
      b: person('b', 1),
      c: person('c', 1),
      kid: person('kid', 1, { parentIds: ['a', 'b', 'c', 'kid'] }),
    },
    unions: {},
  });
  assert.equal(fixed.people.kid.parentIds.length, 2);
  assert.ok(!fixed.people.kid.parentIds.includes('kid'));
});

test('a home person who no longer exists is cleared', () => {
  const fixed = reconcileTree({ name: 'F', people: {}, unions: {}, homeId: 'gone' });
  assert.equal(fixed.homeId, undefined);
});
