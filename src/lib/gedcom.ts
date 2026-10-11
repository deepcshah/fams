/**
 * GEDCOM 5.5.1 reader.
 *
 * Every genealogy service — Geni, Ancestry, MyHeritage, FamilySearch — exports
 * this format, so it is the only realistic way to get a real family into the
 * app. The grammar is a flat list of `LEVEL [@XREF@] TAG [VALUE]` lines whose
 * indentation carries the structure, which is parsed here into a node tree and
 * then mapped onto our own model.
 *
 * Pure, with no runtime imports, so it can be unit tested on its own.
 */

import type { FamilyTree, Gender, LifeEvent, Person, Union, UnionStatus } from '../types';

export type GedcomSummary = {
  /** What wrote the file, from the header. */
  source?: string;
  people: number;
  families: number;
  couples: number;
  events: number;
  withBirthDate: number;
  withPlace: number;
  /** Everything we could not make sense of, in the order we met it. */
  warnings: string[];
};

export type GedcomResult =
  | { ok: true; tree: FamilyTree; summary: GedcomSummary }
  | { ok: false; error: string };

type Node = { tag: string; xref?: string; value: string; children: Node[] };

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** Individual-level events worth keeping, and how to phrase them. */
const EVENT_LABELS: Record<string, string> = {
  RESI: 'Lived in',
  IMMI: 'Immigrated to',
  EMIG: 'Emigrated from',
  NATU: 'Naturalised',
  GRAD: 'Graduated',
  EDUC: 'Studied',
  RETI: 'Retired',
  BAPM: 'Baptised',
  CHR: 'Christened',
  BURI: 'Buried',
  CREM: 'Cremated',
  CENS: 'Recorded in the census',
  MILI: 'Military service',
  ORDN: 'Ordained',
  PROB: 'Probate',
  WILL: 'Wrote a will',
};

function unionKeyOf(a: string, b: string): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

function idFor(xref: string): string {
  return `g_${xref.replace(/[^A-Za-z0-9_]/g, '')}`;
}

/**
 * GEDCOM dates carry qualifiers ("ABT 1904", "BET 1890 AND 1895") that our
 * partial-date format cannot express. We keep the earliest concrete date and
 * drop the qualifier rather than refusing the record.
 */
export function parseGedcomDate(raw: string): string | undefined {
  let value = raw.trim().toUpperCase();
  if (!value) return undefined;
  value = value.replace(/@#D[A-Z_]+@/g, '').trim();
  value = value.replace(/^(ABT|EST|CAL|BEF|AFT|FROM|TO|INT)\s+/, '');
  const between = /^BET(?:WEEN)?\s+(.+?)\s+AND\s+/.exec(value);
  if (between) value = between[1];
  value = value.replace(/\s+AND\s+.*$/, '').replace(/^TO\s+/, '').trim();

  const full = /^(\d{1,2})\s+([A-Z]{3})[A-Z]*\s+(\d{3,4})$/.exec(value);
  if (full) {
    const month = MONTHS[full[2]];
    if (month) {
      return `${full[3].padStart(4, '0')}-${String(month).padStart(2, '0')}-${full[1].padStart(2, '0')}`;
    }
  }
  const monthYear = /^([A-Z]{3})[A-Z]*\s+(\d{3,4})$/.exec(value);
  if (monthYear) {
    const month = MONTHS[monthYear[1]];
    if (month) return `${monthYear[2].padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  }
  const year = /(\d{3,4})\s*$/.exec(value);
  if (year) return year[1].padStart(4, '0');
  return undefined;
}

/** Splits the flat line list into a tree, following the level numbers. */
function parseNodes(text: string): Node[] {
  const root: Node = { tag: 'ROOT', value: '', children: [] };
  const stack: Node[] = [root];

  for (const rawLine of text.replace(/^﻿/, '').split(/\r\n|\r|\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const match = /^\s*(\d+)\s+(?:(@[^@]*@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/.exec(line);
    if (!match) continue;

    const level = Number(match[1]);
    const node: Node = { tag: match[3].toUpperCase(), xref: match[2], value: match[4] ?? '', children: [] };

    // CONC continues the previous value, CONT starts a new line in it.
    const parent = stack[Math.min(level, stack.length - 1)];
    if (node.tag === 'CONC' || node.tag === 'CONT') {
      const target = stack[Math.min(level, stack.length - 1)];
      if (target && target !== root) {
        target.value += (node.tag === 'CONT' ? '\n' : '') + node.value;
      }
      continue;
    }

    if (!parent) continue;
    parent.children.push(node);
    stack.length = level + 1;
    stack[level + 1] = node;
  }

  return root.children;
}

function child(node: Node, tag: string): Node | undefined {
  return node.children.find((c) => c.tag === tag);
}

function childValue(node: Node, tag: string): string | undefined {
  const found = child(node, tag);
  const value = found?.value.trim();
  return value ? value : undefined;
}

function pointer(value: string): string | undefined {
  const match = /^@([^@]+)@$/.exec(value.trim());
  return match ? match[1] : undefined;
}

function genderOf(value?: string): Gender {
  const code = value?.trim().toUpperCase();
  if (code === 'M') return 'male';
  if (code === 'F') return 'female';
  return 'other';
}

/** `Deep /Shah/ Jr` → given "Deep", surname "Shah". */
function splitName(value: string): { given?: string; surname?: string } {
  const match = /^(.*?)\/([^/]*)\/(.*)$/.exec(value);
  if (!match) {
    const trimmed = value.trim();
    return trimmed ? { given: trimmed } : {};
  }
  return {
    given: match[1].trim() || undefined,
    surname: match[2].trim() || undefined,
  };
}

function eventOf(node: Node): { date?: string; place?: string } {
  return {
    date: parseGedcomDate(childValue(node, 'DATE') ?? ''),
    place: childValue(node, 'PLAC'),
  };
}

export function parseGedcom(text: string): GedcomResult {
  if (!/^\s*0\s+HEAD/m.test(text.replace(/^﻿/, ''))) {
    return { ok: false, error: 'That file does not look like a GEDCOM export.' };
  }

  const records = parseNodes(text);
  const warnings: string[] = [];
  const head = records.find((r) => r.tag === 'HEAD');
  const source = head ? (childValue(head, 'SOUR') ?? undefined) : undefined;

  const individuals = records.filter((r) => r.tag === 'INDI' && r.xref);
  const families = records.filter((r) => r.tag === 'FAM' && r.xref);

  if (individuals.length === 0) {
    return { ok: false, error: 'That GEDCOM file contains no people.' };
  }

  const people: Record<string, Person> = {};
  const now = Date.now();
  let eventCount = 0;

  for (const record of individuals) {
    const id = idFor(record.xref!);
    const nameNodes = record.children.filter((c) => c.tag === 'NAME');
    const primary = nameNodes[0];
    const parsed = primary ? splitName(primary.value) : {};

    const given = (primary && childValue(primary, 'GIVN')) ?? parsed.given;
    const surname = (primary && childValue(primary, 'SURN')) ?? parsed.surname;
    const nickname = primary ? childValue(primary, 'NICK') : undefined;

    // A second NAME tagged birth or maiden is where the née surname lives.
    let birthName: string | undefined;
    for (const nameNode of nameNodes.slice(1)) {
      const type = (childValue(nameNode, 'TYPE') ?? '').toLowerCase();
      if (!/birth|maiden/.test(type)) continue;
      birthName = childValue(nameNode, 'SURN') ?? splitName(nameNode.value).surname;
    }
    birthName ??= primary ? childValue(primary, '_MARNM') : undefined;

    const birth = child(record, 'BIRT');
    const death = child(record, 'DEAT');
    const birthEvent = birth ? eventOf(birth) : {};
    const deathEvent = death ? eventOf(death) : {};

    const events: LifeEvent[] = [];
    record.children.forEach((node, index) => {
      const label = EVENT_LABELS[node.tag];
      if (label === undefined) return;
      const { date, place } = eventOf(node);
      const detail = childValue(node, 'TYPE') ?? (node.value.trim() || undefined);
      if (!date && !place && !detail) return;
      const title = [label, place ?? detail].filter(Boolean).join(' ').trim();
      if (!title) return;
      events.push({ id: `${id}_x${index}`, date, title, place });
    });

    people[id] = {
      id,
      firstName: given?.trim() || 'Unnamed',
      lastName: surname?.trim() || undefined,
      birthName: birthName && birthName !== surname ? birthName : undefined,
      nickname,
      gender: genderOf(childValue(record, 'SEX')),
      birthDate: birthEvent.date,
      deathDate: deathEvent.date,
      deceased: Boolean(death),
      birthPlace: birthEvent.place,
      occupation: childValue(record, 'OCCU'),
      bio: childValue(record, 'NOTE'),
      parentIds: [],
      partnerIds: [],
      events,
      createdAt: now,
      updatedAt: now,
    };
    eventCount += events.length;
  }

  const unions: Record<string, Union> = {};
  let coupleCount = 0;

  for (const record of families) {
    const spouseIds = record.children
      .filter((c) => c.tag === 'HUSB' || c.tag === 'WIFE')
      .map((c) => pointer(c.value))
      .filter((x): x is string => Boolean(x))
      .map(idFor)
      .filter((id) => {
        if (people[id]) return true;
        warnings.push(`Family ${record.xref} names a spouse who is not in the file.`);
        return false;
      });

    const childIds = record.children
      .filter((c) => c.tag === 'CHIL')
      .map((c) => pointer(c.value))
      .filter((x): x is string => Boolean(x))
      .map(idFor)
      .filter((id) => {
        if (people[id]) return true;
        warnings.push(`Family ${record.xref} names a child who is not in the file.`);
        return false;
      });

    for (const childId of childIds) {
      for (const spouseId of spouseIds) {
        if (people[childId].parentIds.length >= 2) break;
        if (!people[childId].parentIds.includes(spouseId)) people[childId].parentIds.push(spouseId);
      }
    }

    if (spouseIds.length < 2) continue;

    const marriage = child(record, 'MARR');
    const divorce = child(record, 'DIV');
    const marriageEvent = marriage ? eventOf(marriage) : {};
    const divorceEvent = divorce ? eventOf(divorce) : {};

    let status: UnionStatus = marriage ? 'married' : 'partners';
    if (divorce) status = 'divorced';
    else if (marriage) {
      const widowed = spouseIds.some((id) => people[id].deathDate);
      if (widowed) status = 'widowed';
    }

    for (let i = 0; i < spouseIds.length; i += 1) {
      for (let j = i + 1; j < spouseIds.length; j += 1) {
        const a = spouseIds[i];
        const b = spouseIds[j];
        if (!people[a].partnerIds.includes(b)) people[a].partnerIds.push(b);
        if (!people[b].partnerIds.includes(a)) people[b].partnerIds.push(a);
        const key = unionKeyOf(a, b);
        if (!unions[key]) {
          unions[key] = {
            key,
            partnerIds: key.split('~') as [string, string],
            status,
            since: marriageEvent.date,
            until: divorceEvent.date,
          };
          coupleCount += 1;
        }
      }
    }

    // A marriage is a moment in both their lives, not just a line on a chart.
    if (marriageEvent.date || marriageEvent.place) {
      for (const spouseId of spouseIds) {
        const other = spouseIds.find((id) => id !== spouseId);
        const otherName = other
          ? [people[other].firstName, people[other].lastName].filter(Boolean).join(' ')
          : undefined;
        people[spouseId].events = [
          ...(people[spouseId].events ?? []),
          {
            id: `${idFor(record.xref!)}_marr_${spouseId}`,
            date: marriageEvent.date,
            title: otherName ? `Married ${otherName}` : 'Married',
            place: marriageEvent.place,
          },
        ];
        eventCount += 1;
      }
    }
  }

  const all = Object.values(people);
  const name = surnameTitle(all) ?? 'Imported Family';

  return {
    ok: true,
    tree: { name, people, unions, homeId: undefined },
    summary: {
      source,
      people: all.length,
      families: families.length,
      couples: coupleCount,
      events: eventCount,
      withBirthDate: all.filter((p) => p.birthDate).length,
      withPlace: all.filter((p) => p.birthPlace).length,
      warnings: [...new Set(warnings)].slice(0, 12),
    },
  };
}

/** "The Shah Family", from whichever surname turns up most. */
function surnameTitle(people: Person[]): string | undefined {
  const counts = new Map<string, number>();
  for (const person of people) {
    const surname = person.lastName?.trim();
    if (!surname) continue;
    counts.set(surname, (counts.get(surname) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? `The ${best[0]} Family` : undefined;
}
