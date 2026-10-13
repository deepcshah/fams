/**
 * A person's life as an ordered sequence of moments. Birth and death are
 * derived from the person record; everything between them is recorded by hand.
 * Pure, with no runtime imports, so it can be unit tested on its own.
 */

import type { LifeEvent, Person } from '../types';

export type TimelineEntry = {
  id: string;
  /** Partial ISO date, or undefined when only the fact is known. */
  date?: string;
  title: string;
  place?: string;
  kind: 'birth' | 'event' | 'death';
  /** Derived entries are edited on the person, not as an event. */
  editable: boolean;
};

const UNDATED = Number.POSITIVE_INFINITY;

function sortKey(value?: string): number {
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(value ?? '');
  if (!match) return UNDATED;
  return Number(match[1]) * 10000 + Number(match[2] ?? 1) * 100 + Number(match[3] ?? 1);
}

export function buildTimeline(person: Person): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (person.birthDate || person.birthPlace) {
    entries.push({
      id: `${person.id}:birth`,
      date: person.birthDate,
      title: person.birthPlace ? `Born in ${person.birthPlace}` : 'Born',
      place: person.birthPlace,
      kind: 'birth',
      editable: false,
    });
  }

  for (const event of person.events ?? []) {
    entries.push({
      id: event.id,
      date: event.date,
      title: event.title,
      place: event.place,
      kind: 'event',
      editable: true,
    });
  }

  if (person.deathDate || person.deceased) {
    entries.push({
      id: `${person.id}:death`,
      date: person.deathDate,
      title: 'Died',
      kind: 'death',
      editable: false,
    });
  }

  // Undated entries keep their insertion order at the end rather than being
  // dropped — a remembered fact with no year is still worth showing.
  return entries
    .map((entry, index) => ({ entry, index, key: sortKey(entry.date) }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key - b.key))
    .map(({ entry }) => entry);
}

/** Every image attached to a person: their portrait first, then the album. */
export function galleryOf(person: Person): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const uri of [person.photoUri, ...(person.photos ?? [])]) {
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    out.push(uri);
  }
  return out;
}

/** Distinct places mentioned by a person's life, in chronological order. */
export function placesOf(person: Person): { place: string; date?: string; title: string }[] {
  const seen = new Set<string>();
  const out: { place: string; date?: string; title: string }[] = [];
  for (const entry of buildTimeline(person)) {
    if (!entry.place || seen.has(entry.place)) continue;
    seen.add(entry.place);
    out.push({ place: entry.place, date: entry.date, title: entry.title });
  }
  return out;
}

export function createEvent(partial: Omit<LifeEvent, 'id'> & { id?: string }): LifeEvent {
  return {
    id: partial.id ?? `ev_${Math.random().toString(36).slice(2, 11)}`,
    date: partial.date,
    title: partial.title,
    place: partial.place,
  };
}
