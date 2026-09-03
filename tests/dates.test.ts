import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ageOf,
  dateSortKey,
  daysUntilBirthday,
  formatDate,
  lifespan,
  normalizeDateInput,
  parseDate,
  yearsBetween,
} from '../src/lib/dates.ts';

test('partial dates parse without throwing', () => {
  assert.deepEqual(parseDate('1948'), { year: 1948, month: undefined, day: undefined });
  assert.deepEqual(parseDate('1948-03'), { year: 1948, month: 3, day: undefined });
  assert.deepEqual(parseDate('1948-03-11'), { year: 1948, month: 3, day: 11 });
  assert.equal(parseDate(''), null);
  assert.equal(parseDate(undefined), null);
  assert.equal(parseDate('not a date'), null);
});

test('out-of-range parts are dropped rather than trusted', () => {
  assert.deepEqual(parseDate('1948-13'), { year: 1948 });
  assert.deepEqual(parseDate('1948-03-45'), { year: 1948, month: 3 });
});

test('sort keys order partial dates correctly', () => {
  const sorted = ['1948-03-11', '1948', '1947-12', '1948-03'].sort((a, b) => dateSortKey(a) - dateSortKey(b));
  assert.deepEqual(sorted, ['1947-12', '1948', '1948-03', '1948-03-11']);
  assert.equal(dateSortKey(undefined), Number.POSITIVE_INFINITY);
});

test('dates format down to whatever precision is known', () => {
  assert.equal(formatDate('1948'), '1948');
  assert.equal(formatDate('1948-03'), 'March 1948');
  assert.equal(formatDate('1948-03-11'), 'March 11, 1948');
  assert.equal(formatDate('1948-03-11', 'short'), 'Mar 11, 1948');
  assert.equal(formatDate(undefined), '');
});

test('lifespans read the way people write them', () => {
  assert.equal(lifespan('1948', '2011'), '1948–2011');
  assert.equal(lifespan('1948'), 'b. 1948');
  assert.equal(lifespan('1948', undefined, true), '1948–');
  assert.equal(lifespan(undefined, undefined), '');
  assert.equal(lifespan(undefined, undefined, true), 'Dates unknown');
});

test('ages account for whether the birthday has passed', () => {
  const now = new Date(2024, 5, 15); // 15 June 2024
  assert.equal(yearsBetween('1990-06-14', null, now), 34);
  assert.equal(yearsBetween('1990-06-16', null, now), 33);
  assert.equal(yearsBetween('1990-12-01', null, now), 33);
  assert.equal(yearsBetween('1948-03-11', '2011-05-02'), 63);
});

test('ageOf reports whether the age is at death', () => {
  const now = new Date(2024, 0, 1);
  assert.deepEqual(ageOf({ birthDate: '1990', deathDate: '2020' }, now), { years: 30, atDeath: true });
  assert.deepEqual(ageOf({ birthDate: '1990' }, now), { years: 34, atDeath: false });
  assert.equal(ageOf({}, now), null);
});

test('birthday countdown rolls over into next year', () => {
  const now = new Date(2024, 5, 15);
  assert.equal(daysUntilBirthday('1990-06-15', now), 0);
  assert.equal(daysUntilBirthday('1990-06-20', now), 5);
  assert.equal(daysUntilBirthday('1990-06-10', now), 360);
  assert.equal(daysUntilBirthday('1990', now), null);
});

test('loose input is normalised into storage form', () => {
  assert.equal(normalizeDateInput('11/03/1948'), '1948-11-03');
  assert.equal(normalizeDateInput('1948'), '1948');
  assert.equal(normalizeDateInput('1948-3-1'), '1948-03-01');
  assert.equal(normalizeDateInput('  '), '');
});
