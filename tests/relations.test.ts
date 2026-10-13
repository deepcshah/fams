import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ancestorsOf,
  computeStats,
  descendantsOf,
  kinshipLabel,
  lineageOf,
  matchScore,
  siblingsOf,
  subsetPeople,
} from '../src/lib/relations.ts';
import { computeGenerations, layoutFamilyTree } from '../src/lib/layout.ts';
import { createSampleTree } from '../src/data/sampleFamily.ts';
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

function toMap(people: Person[]): Record<string, Person> {
  return Object.fromEntries(people.map((p) => [p.id, p]));
}

/**
 *        gran ── grandad
 *          │
 *   ┌──────┴──────┐
 *  mum ── dad    aunt
 *   │             │
 *  me           cousin
 */
const FAMILY = toMap([
  person('gran', { gender: 'female', partnerIds: ['grandad'] }),
  person('grandad', { gender: 'male', partnerIds: ['gran'] }),
  person('mum', { gender: 'female', parentIds: ['gran', 'grandad'], partnerIds: ['dad'] }),
  person('aunt', { gender: 'female', parentIds: ['gran', 'grandad'] }),
  person('dad', { gender: 'male', partnerIds: ['mum'] }),
  person('me', { gender: 'other', parentIds: ['mum', 'dad'] }),
  person('cousin', { gender: 'male', parentIds: ['aunt'] }),
]);

test('siblings share at least one parent', () => {
  assert.deepEqual(
    siblingsOf(FAMILY, 'mum').map((p) => p.id),
    ['aunt'],
  );
  assert.deepEqual(siblingsOf(FAMILY, 'gran'), []);
});

test('ancestors and descendants walk the whole chain', () => {
  assert.deepEqual([...ancestorsOf(FAMILY, 'me')].sort(), ['dad', 'gran', 'grandad', 'mum']);
  assert.deepEqual([...descendantsOf(FAMILY, 'gran')].sort(), ['aunt', 'cousin', 'me', 'mum']);
});

test('descendants respect a depth limit', () => {
  assert.deepEqual([...descendantsOf(FAMILY, 'gran', 1)].sort(), ['aunt', 'mum']);
});

test('kinship naming covers the common cases', () => {
  assert.equal(kinshipLabel(FAMILY, 'me', 'me'), 'you');
  assert.equal(kinshipLabel(FAMILY, 'me', 'mum'), 'mother');
  assert.equal(kinshipLabel(FAMILY, 'me', 'dad'), 'father');
  assert.equal(kinshipLabel(FAMILY, 'me', 'gran'), 'grandmother');
  assert.equal(kinshipLabel(FAMILY, 'me', 'aunt'), 'aunt');
  assert.equal(kinshipLabel(FAMILY, 'me', 'cousin'), 'cousin');
  assert.equal(kinshipLabel(FAMILY, 'gran', 'me'), 'grandchild');
  assert.equal(kinshipLabel(FAMILY, 'mum', 'aunt'), 'sister');
  assert.equal(kinshipLabel(FAMILY, 'mum', 'dad'), 'husband');
  assert.equal(kinshipLabel(FAMILY, 'dad', 'gran'), 'mother-in-law');
});

test('kinship handles great-grandparents and removed cousins', () => {
  const deep = toMap([
    person('gg'),
    person('g', { parentIds: ['gg'] }),
    person('p', { parentIds: ['g'] }),
    person('c', { parentIds: ['p'] }),
    person('g2', { parentIds: ['gg'] }),
    person('p2', { parentIds: ['g2'] }),
  ]);
  assert.equal(kinshipLabel(deep, 'c', 'gg'), 'great-grandparent');
  assert.equal(kinshipLabel(deep, 'p', 'p2'), 'cousin');
  assert.equal(kinshipLabel(deep, 'c', 'p2'), 'cousin once removed');
});

test('an unrelated person is just a relative, not a crash', () => {
  const withStranger = { ...FAMILY, stranger: person('stranger') };
  assert.equal(kinshipLabel(withStranger, 'me', 'stranger'), 'relative');
});

test('lineage keeps the focus branch and drops nobody who is needed', () => {
  const keep = lineageOf(FAMILY, 'me');
  for (const id of ['me', 'mum', 'dad', 'gran', 'grandad', 'aunt', 'cousin']) {
    assert.ok(keep.has(id), `expected ${id} in lineage`);
  }
});

test('subsetPeople strips references that point outside the subset', () => {
  const subset = subsetPeople(FAMILY, new Set(['me', 'mum']));
  const me = subset.find((p) => p.id === 'me')!;
  assert.deepEqual(me.parentIds, ['mum']);
  const mum = subset.find((p) => p.id === 'mum')!;
  assert.deepEqual(mum.parentIds, []);
  assert.deepEqual(mum.partnerIds, []);
});

test('search scores exact and prefix matches above substring matches', () => {
  const ada = person('x', { firstName: 'Adaeze', lastName: 'Okafor', birthPlace: 'Manchester' });
  assert.ok(matchScore(ada, 'Adaeze Okafor') > matchScore(ada, 'Adaeze'));
  assert.ok(matchScore(ada, 'Adaeze') > matchScore(ada, 'kafor'));
  assert.ok(matchScore(ada, 'Manchester') > 0);
  assert.equal(matchScore(ada, 'zzz'), 0);
});

test('stats summarise the tree', () => {
  const generations = computeGenerations(Object.values(FAMILY));
  const stats = computeStats(FAMILY, generations, () => null);
  assert.equal(stats.total, 7);
  assert.equal(stats.generations, 3);
  assert.equal(stats.couples, 2);
});

test('the sample family is internally consistent', () => {
  const tree = createSampleTree();
  const people = Object.values(tree.people);
  assert.ok(people.length >= 18);

  for (const person of people) {
    for (const parentId of person.parentIds) {
      assert.ok(tree.people[parentId], `${person.id} has a dangling parent ${parentId}`);
    }
    for (const partnerId of person.partnerIds) {
      assert.ok(tree.people[partnerId], `${person.id} has a dangling partner ${partnerId}`);
      assert.ok(
        tree.people[partnerId].partnerIds.includes(person.id),
        `partnership ${person.id}/${partnerId} is not symmetric`,
      );
    }
  }
  assert.ok(tree.homeId && tree.people[tree.homeId]);
});

test('the sample family lays out without overlaps across four generations', () => {
  const tree = createSampleTree();
  const layout = layoutFamilyTree(Object.values(tree.people), { unions: tree.unions });

  assert.equal(layout.nodes.length, Object.keys(tree.people).length);
  assert.equal(layout.generationRows.length, 4);

  const rows = new Map<number, { x: number; width: number }[]>();
  for (const node of layout.nodes) {
    const row = rows.get(node.generation) ?? [];
    row.push({ x: node.x, width: node.width });
    rows.set(node.generation, row);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i += 1) {
      assert.ok(row[i].x >= row[i - 1].x + row[i - 1].width - 0.001);
    }
  }
});

test('in-laws are named through the relative they married', () => {
  const inlaws = toMap([
    person('gran', { gender: 'female' }),
    person('mother', { gender: 'female', parentIds: ['gran'] }),
    person('me', { gender: 'other', parentIds: ['mother'], partnerIds: ['spouse'] }),
    person('spouse', { gender: 'female', partnerIds: ['me'], parentIds: ['spouseMum'] }),
    person('spouseMum', { gender: 'female' }),
    person('aunt', { gender: 'female', parentIds: ['gran'], partnerIds: ['auntHusband'] }),
    person('auntHusband', { gender: 'male', partnerIds: ['aunt'] }),
    person('sib', { gender: 'male', parentIds: ['mother'], partnerIds: ['sibWife'] }),
    person('sibWife', { gender: 'female', partnerIds: ['sib'] }),
  ]);
  assert.equal(kinshipLabel(inlaws, 'me', 'spouse'), 'wife');
  assert.equal(kinshipLabel(inlaws, 'me', 'spouseMum'), 'mother-in-law');
  assert.equal(kinshipLabel(inlaws, 'me', 'auntHusband'), 'uncle');
  assert.equal(kinshipLabel(inlaws, 'me', 'sibWife'), 'sister-in-law');
});

test("a parent's later partner is a step-parent", () => {
  const step = toMap([
    person('me', { parentIds: ['mum'] }),
    person('mum', { gender: 'female', partnerIds: ['stepdad'] }),
    person('stepdad', { gender: 'male', partnerIds: ['mum'] }),
  ]);
  assert.equal(kinshipLabel(step, 'me', 'stepdad'), 'step-father');
});
