/** Core domain types for a family tree. */

export type Gender = 'female' | 'male' | 'other';

export type Person = {
  id: string;
  firstName: string;
  lastName?: string;
  /** Family name at birth, shown as "née" when it differs from lastName. */
  birthName?: string;
  nickname?: string;
  gender: Gender;
  /** Partial ISO dates are allowed: "1948", "1948-03", "1948-03-11". */
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  occupation?: string;
  bio?: string;
  photoUri?: string;
  /** Biological or adoptive parents. Zero, one or two entries in practice. */
  parentIds: string[];
  /** Symmetric: if A lists B, B lists A. Maintained by the store. */
  partnerIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type UnionStatus = 'married' | 'partners' | 'engaged' | 'separated' | 'divorced' | 'widowed';

/** A partnership between two people. Keyed by `unionKey(a, b)`. */
export type Union = {
  key: string;
  partnerIds: [string, string];
  status: UnionStatus;
  since?: string;
  until?: string;
};

export type FamilyTree = {
  name: string;
  people: Record<string, Person>;
  unions: Record<string, Union>;
  /** The person the tree opens on — usually "me". */
  homeId?: string;
};

export type PersonDraft = Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'parentIds' | 'partnerIds'> &
  Partial<Pick<Person, 'parentIds' | 'partnerIds'>>;

/** Stable key for a partnership, independent of argument order. */
export function unionKey(a: string, b: string): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}
