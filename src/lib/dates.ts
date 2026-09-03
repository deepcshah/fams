/**
 * Dates in a family tree are frequently partial — a year, sometimes a month.
 * Everything here accepts "1948", "1948-03" or "1948-03-11" and degrades
 * gracefully rather than throwing.
 */

export type PartialDate = { year: number; month?: number; day?: number };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function parseDate(value?: string | null): PartialDate | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return null;
  const month = match[2] ? Number(match[2]) : undefined;
  const day = match[3] ? Number(match[3]) : undefined;
  if (month !== undefined && (month < 1 || month > 12)) return { year };
  if (day !== undefined && (day < 1 || day > 31)) return { year, month };
  return { year, month, day };
}

/** Sortable number: 19480311, 194803, 1948 all compare correctly once scaled. */
export function dateSortKey(value?: string | null): number {
  const parsed = parseDate(value);
  if (!parsed) return Number.POSITIVE_INFINITY;
  return parsed.year * 10000 + (parsed.month ?? 1) * 100 + (parsed.day ?? 1);
}

export function formatDate(value?: string | null, style: 'long' | 'short' = 'long'): string {
  const parsed = parseDate(value);
  if (!parsed) return '';
  const { year, month, day } = parsed;
  if (month === undefined) return String(year);
  const name = style === 'long' ? MONTHS[month - 1] : MONTHS[month - 1].slice(0, 3);
  if (day === undefined) return `${name} ${year}`;
  return `${name} ${day}, ${year}`;
}

export function formatYear(value?: string | null): string {
  const parsed = parseDate(value);
  return parsed ? String(parsed.year) : '';
}

/** "1948 – 2011", "b. 1948", "1948 – " for a deceased person with no death year. */
export function lifespan(birthDate?: string | null, deathDate?: string | null, deceased = false): string {
  const born = formatYear(birthDate);
  const died = formatYear(deathDate);
  if (born && died) return `${born}–${died}`;
  if (born && (deceased || deathDate)) return `${born}–`;
  if (born) return `b. ${born}`;
  if (died) return `d. ${died}`;
  return deceased ? 'Dates unknown' : '';
}

function todayParts(now = new Date()): PartialDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Whole years between two partial dates; null when the birth year is unknown. */
export function yearsBetween(from?: string | null, to?: PartialDate | string | null, now = new Date()): number | null {
  const start = parseDate(from);
  if (!start) return null;
  const end = typeof to === 'string' ? parseDate(to) : (to ?? todayParts(now));
  if (!end) return null;
  let years = end.year - start.year;
  const startMonth = start.month ?? 1;
  const endMonth = end.month ?? 12;
  if (endMonth < startMonth) {
    years -= 1;
  } else if (endMonth === startMonth) {
    const startDay = start.day ?? 1;
    const endDay = end.day ?? 28;
    if (endDay < startDay) years -= 1;
  }
  return years < 0 ? null : years;
}

export function ageOf(
  person: { birthDate?: string; deathDate?: string },
  now = new Date(),
): { years: number; atDeath: boolean } | null {
  if (!person.birthDate) return null;
  const years = yearsBetween(person.birthDate, person.deathDate ?? null, now);
  if (years === null) return null;
  return { years, atDeath: Boolean(person.deathDate) };
}

/** Days until the next anniversary of a birthday; null if day/month unknown. */
export function daysUntilBirthday(birthDate?: string | null, now = new Date()): number | null {
  const parsed = parseDate(birthDate);
  if (!parsed || parsed.month === undefined || parsed.day === undefined) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), parsed.month - 1, parsed.day);
  if (next.getTime() < today.getTime()) next = new Date(now.getFullYear() + 1, parsed.month - 1, parsed.day);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/** Normalises loose user input ("11/03/1948", "1948") into our storage form. */
export function normalizeDateInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const slashed = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(trimmed);
  if (slashed) {
    const [, a, b, y] = slashed;
    return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
  }
  const parsed = parseDate(trimmed);
  if (!parsed) return trimmed;
  const parts = [String(parsed.year)];
  if (parsed.month !== undefined) parts.push(String(parsed.month).padStart(2, '0'));
  if (parsed.day !== undefined) parts.push(String(parsed.day).padStart(2, '0'));
  return parts.join('-');
}
