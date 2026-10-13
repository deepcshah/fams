import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildTimeline, createEvent, galleryOf, placesOf } from '../src/lib/story.ts';
import { scatterLayout, type ScatterItem } from '../src/lib/scatter.ts';
import type { Person } from '../src/types.ts';

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    firstName: 'Jozo',
    lastName: 'Batina',
    gender: 'male',
    parentIds: [],
    partnerIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

test('a timeline brackets recorded moments with birth and death', () => {
  const entries = buildTimeline(
    person({
      birthDate: '1951-09-03',
      birthPlace: 'Batine, Trebinje',
      deathDate: '2019',
      events: [
        createEvent({ id: 'e2', date: '1972', title: 'Joins military' }),
        createEvent({ id: 'e1', date: '1961', title: 'Moves to Dubrovnik', place: 'Dubrovnik' }),
      ],
    }),
  );
  assert.deepEqual(
    entries.map((e) => e.kind),
    ['birth', 'event', 'event', 'death'],
  );
  assert.equal(entries[0].title, 'Born in Batine, Trebinje');
  assert.deepEqual(
    entries.map((e) => e.date),
    ['1951-09-03', '1961', '1972', '2019'],
  );
});

test('derived entries are not editable but recorded ones are', () => {
  const entries = buildTimeline(
    person({ birthDate: '1951', deathDate: '2019', events: [createEvent({ date: '1970', title: 'Married' })] }),
  );
  assert.deepEqual(
    entries.map((e) => e.editable),
    [false, true, false],
  );
});

test('an undated moment is kept, at the end', () => {
  const entries = buildTimeline(
    person({
      birthDate: '1951',
      events: [createEvent({ title: 'Learned to sail' }), createEvent({ date: '1980', title: 'Bought the house' })],
    }),
  );
  assert.deepEqual(
    entries.map((e) => e.title),
    ['Born', 'Bought the house', 'Learned to sail'],
  );
});

test('a person with nothing recorded has an empty timeline', () => {
  assert.deepEqual(buildTimeline(person()), []);
});

test('the gallery leads with the portrait and drops duplicates', () => {
  const gallery = galleryOf(person({ photoUri: 'a.jpg', photos: ['b.jpg', 'a.jpg', 'c.jpg'] }));
  assert.deepEqual(gallery, ['a.jpg', 'b.jpg', 'c.jpg']);
});

test('places are listed once, in chronological order', () => {
  const places = placesOf(
    person({
      birthDate: '1951',
      birthPlace: 'Batine',
      events: [
        createEvent({ date: '1990', title: 'Returns home', place: 'Batine' }),
        createEvent({ date: '1961', title: 'Moves', place: 'Dubrovnik' }),
      ],
    }),
  );
  assert.deepEqual(
    places.map((p) => p.place),
    ['Batine', 'Dubrovnik'],
  );
});

const HERO: ScatterItem = { id: 'hero', width: 200, height: 260 };
const items = (n: number): ScatterItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `i${i}`, width: 160 + (i % 3) * 30, height: 140 + (i % 2) * 60 }));

test('scatter places the hero at the centre', () => {
  const result = scatterLayout(HERO, items(6));
  const hero = result.byId.hero;
  assert.equal(hero.x, -100);
  assert.equal(hero.y, -130);
});

test('scatter never overlaps two cards', () => {
  const result = scatterLayout(HERO, items(24), { gap: 30 });
  assert.equal(result.placements.length, 25);
  for (let i = 0; i < result.placements.length; i += 1) {
    for (let j = i + 1; j < result.placements.length; j += 1) {
      const a = result.placements[i];
      const b = result.placements[j];
      const apart =
        a.x + a.width <= b.x + 0.001 ||
        b.x + b.width <= a.x + 0.001 ||
        a.y + a.height <= b.y + 0.001 ||
        b.y + b.height <= a.y + 0.001;
      assert.ok(apart, `${a.id} overlaps ${b.id}`);
    }
  }
});

test('scatter is deterministic for the same input', () => {
  const a = scatterLayout(HERO, items(12));
  const b = scatterLayout(HERO, items(12));
  assert.deepEqual(a.placements, b.placements);
});

test('scatter reports bounds that contain every card', () => {
  const result = scatterLayout(HERO, items(10));
  for (const p of result.placements) {
    assert.ok(p.x >= result.bounds.minX - 0.001 && p.x + p.width <= result.bounds.maxX + 0.001);
    assert.ok(p.y >= result.bounds.minY - 0.001 && p.y + p.height <= result.bounds.maxY + 0.001);
  }
  assert.equal(result.width, result.bounds.maxX - result.bounds.minX);
});

test('a life with no cards is just the hero', () => {
  const result = scatterLayout(HERO, []);
  assert.equal(result.placements.length, 1);
  assert.equal(result.width, 200);
});
