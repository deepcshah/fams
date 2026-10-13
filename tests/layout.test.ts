import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COUPLE_GAP, NODE_W, ROW_H, computeGenerations, layoutFamilyTree } from '../src/lib/layout.ts';
import type { Person } from '../src/types.ts';

function person(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: id,
    gender: 'other',
    parentIds: [],
    partnerIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function couple(a: string, b: string, overrides: Partial<Person> = {}): Person[] {
  return [
    person(a, { partnerIds: [b], ...overrides }),
    person(b, { partnerIds: [a], ...overrides }),
  ];
}

test('generations: a child sits one row below its deepest parent', () => {
  const people = [
    person('grandpa'),
    person('dad', { parentIds: ['grandpa'] }),
    person('kid', { parentIds: ['dad'] }),
  ];
  const generations = computeGenerations(people);
  assert.equal(generations.grandpa, 0);
  assert.equal(generations.dad, 1);
  assert.equal(generations.kid, 2);
});

test('generations: partners are pulled onto the same row', () => {
  // "outsider" has no parents but marries into generation 1.
  const people = [
    person('root'),
    person('child', { parentIds: ['root'], partnerIds: ['outsider'] }),
    person('outsider', { partnerIds: ['child'] }),
  ];
  const generations = computeGenerations(people);
  assert.equal(generations.child, 1);
  assert.equal(generations.outsider, 1);
});

test('generations: the deeper of two parents wins', () => {
  const people = [
    person('a'),
    person('b', { parentIds: ['a'] }),
    person('c', { parentIds: ['b'] }),
    person('d', { parentIds: ['a', 'c'] }),
  ];
  const generations = computeGenerations(people);
  assert.equal(generations.d, 3);
});

test('generations: a parent cycle terminates instead of hanging', () => {
  const people = [person('a', { parentIds: ['b'] }), person('b', { parentIds: ['a'] })];
  const generations = computeGenerations(people);
  assert.ok(Number.isFinite(generations.a));
  assert.ok(Number.isFinite(generations.b));
});

test('layout: partners are drawn side by side in one unit', () => {
  const people = couple('mum', 'dad');
  const layout = layoutFamilyTree(people);
  const mum = layout.nodeById.mum;
  const dad = layout.nodeById.dad;
  assert.equal(mum.unitId, dad.unitId);
  assert.equal(mum.y, dad.y);
  assert.equal(Math.abs(mum.x - dad.x), NODE_W + COUPLE_GAP);
  assert.equal(layout.partnerLinks.length, 1);
});

test('layout: parents are centred over their children', () => {
  const people = [
    ...couple('mum', 'dad'),
    person('kid1', { parentIds: ['mum', 'dad'] }),
    person('kid2', { parentIds: ['mum', 'dad'] }),
    person('kid3', { parentIds: ['mum', 'dad'] }),
  ];
  const layout = layoutFamilyTree(people);
  const parentUnit = layout.unitById[layout.nodeById.mum.unitId];
  const parentCentre = parentUnit.x + parentUnit.width / 2;
  const kidCentres = ['kid1', 'kid2', 'kid3'].map((id) => layout.nodeById[id].x + NODE_W / 2);
  const childrenCentre = (Math.min(...kidCentres) + Math.max(...kidCentres)) / 2;
  assert.ok(Math.abs(parentCentre - childrenCentre) < 0.001, `${parentCentre} vs ${childrenCentre}`);
});

test('layout: cards in one generation never overlap', () => {
  const people = [
    ...couple('g1', 'g2'),
    person('a', { parentIds: ['g1', 'g2'], partnerIds: ['aw'] }),
    person('aw', { partnerIds: ['a'] }),
    person('b', { parentIds: ['g1', 'g2'], partnerIds: ['bw'] }),
    person('bw', { partnerIds: ['b'] }),
    person('a1', { parentIds: ['a', 'aw'] }),
    person('a2', { parentIds: ['a', 'aw'] }),
    person('b1', { parentIds: ['b', 'bw'] }),
    person('b2', { parentIds: ['b', 'bw'] }),
    person('b3', { parentIds: ['b', 'bw'] }),
  ];
  const layout = layoutFamilyTree(people);

  const rows = new Map<number, { x: number; width: number }[]>();
  for (const node of layout.nodes) {
    const row = rows.get(node.generation) ?? [];
    row.push({ x: node.x, width: node.width });
    rows.set(node.generation, row);
  }
  for (const [generation, row] of rows) {
    row.sort((p, q) => p.x - q.x);
    for (let i = 1; i < row.length; i += 1) {
      assert.ok(
        row[i].x >= row[i - 1].x + row[i - 1].width - 0.001,
        `overlap in generation ${generation}: ${JSON.stringify(row)}`,
      );
    }
  }
});

test('layout: every person is placed exactly once', () => {
  const people = [
    ...couple('g1', 'g2'),
    person('a', { parentIds: ['g1', 'g2'], partnerIds: ['aw'] }),
    person('aw', { partnerIds: ['a'] }),
    person('a1', { parentIds: ['a', 'aw'] }),
    person('lonely'),
  ];
  const layout = layoutFamilyTree(people);
  assert.equal(layout.nodes.length, people.length);
  assert.equal(new Set(layout.nodes.map((n) => n.personId)).size, people.length);
});

test('layout: generation rows are one ROW_H apart', () => {
  const people = [person('root'), person('kid', { parentIds: ['root'] })];
  const layout = layoutFamilyTree(people);
  assert.equal(layout.nodeById.kid.y - layout.nodeById.root.y, ROW_H);
});

test('layout: collapsing a unit hides its descendants and reports the count', () => {
  const people = [
    ...couple('mum', 'dad'),
    person('kid', { parentIds: ['mum', 'dad'] }),
    person('grandkid', { parentIds: ['kid'] }),
  ];
  const full = layoutFamilyTree(people);
  const unitId = full.nodeById.mum.unitId;

  const collapsed = layoutFamilyTree(people, { collapsedUnitIds: new Set([unitId]) });
  assert.equal(collapsed.unitById[unitId].collapsed, true);
  assert.equal(collapsed.unitById[unitId].hiddenDescendants, 2);
  assert.equal(collapsed.descentLinks.filter((l) => l.parentUnitId === unitId).length, 0);
});

test('layout: each child gets one descent link from its parents', () => {
  const people = [
    ...couple('mum', 'dad'),
    person('kid1', { parentIds: ['mum', 'dad'] }),
    person('kid2', { parentIds: ['mum', 'dad'] }),
  ];
  const layout = layoutFamilyTree(people);
  assert.equal(layout.descentLinks.length, 2);
  assert.deepEqual(layout.descentLinks.map((l) => l.childId).sort(), ['kid1', 'kid2']);
  for (const link of layout.descentLinks) assert.match(link.path, /^M /);
});

test('layout: an empty tree produces empty, non-NaN bounds', () => {
  const layout = layoutFamilyTree([]);
  assert.equal(layout.nodes.length, 0);
  assert.deepEqual(layout.bounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  assert.equal(layout.width, 0);
});

test('layout: siblings are ordered oldest to youngest', () => {
  const people = [
    person('parent'),
    person('younger', { parentIds: ['parent'], birthDate: '2001' }),
    person('older', { parentIds: ['parent'], birthDate: '1995' }),
  ];
  const layout = layoutFamilyTree(people);
  assert.ok(layout.nodeById.older.x < layout.nodeById.younger.x);
});

test('collapsing only hides descendants that have no other route onto the canvas', () => {
  // "kid" marries "inlaw", whose own parents are also on the canvas, so the
  // couple stays visible when kid's parents collapse. "solo" disappears.
  const people = [
    ...couple('mum', 'dad'),
    ...couple('otherMum', 'otherDad'),
    person('kid', { parentIds: ['mum', 'dad'], partnerIds: ['inlaw'] }),
    person('inlaw', { parentIds: ['otherMum', 'otherDad'], partnerIds: ['kid'] }),
    person('solo', { parentIds: ['mum', 'dad'] }),
  ];
  const unitId = layoutFamilyTree(people).nodeById.mum.unitId;
  const collapsed = layoutFamilyTree(people, { collapsedUnitIds: new Set([unitId]) });

  assert.ok(collapsed.nodeById.kid, 'kid stays, reached through their in-laws');
  assert.ok(collapsed.nodeById.inlaw);
  assert.equal(collapsed.nodeById.solo, undefined, 'solo has no other route and is hidden');
  assert.equal(collapsed.unitById[unitId].hiddenDescendants, 1);
});

test('collapsing a couple whose branch is fully shared is a no-op', () => {
  const people = [
    ...couple('mum', 'dad'),
    ...couple('otherMum', 'otherDad'),
    person('kid', { parentIds: ['mum', 'dad'], partnerIds: ['inlaw'] }),
    person('inlaw', { parentIds: ['otherMum', 'otherDad'], partnerIds: ['kid'] }),
  ];
  const unitId = layoutFamilyTree(people).nodeById.mum.unitId;
  const collapsed = layoutFamilyTree(people, { collapsedUnitIds: new Set([unitId]) });
  assert.equal(collapsed.unitById[unitId].collapsed, false);
  assert.equal(collapsed.nodes.length, people.length);
});

test('partner links are centred on the photograph, not the whole card', () => {
  const layout = layoutFamilyTree(couple('a', 'b'));
  const link = layout.partnerLinks[0];
  assert.equal(link.y1, link.y2);
  assert.ok(link.y1 < layout.nodeById.a.y + layout.nodeById.a.height / 2, 'sits above the card centre');
});

test('descent links are square elbows, never curves', () => {
  const people = [
    ...couple('mum', 'dad'),
    person('kid1', { parentIds: ['mum', 'dad'] }),
    person('kid2', { parentIds: ['mum', 'dad'] }),
  ];
  for (const link of layoutFamilyTree(people).descentLinks) {
    assert.ok(!/[QCA]/.test(link.path), `expected no curve commands in ${link.path}`);
  }
});
