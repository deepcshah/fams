import type { FamilyTree, Gender, LifeEvent, Person, Union, UnionStatus } from '../types';

/** Mirrors `unionKey` from ../types; kept local so this module stays import-free. */
function keyFor(a: string, b: string): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

type Seed = {
  id: string;
  firstName: string;
  lastName?: string;
  birthName?: string;
  nickname?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  occupation?: string;
  bio?: string;
  parentIds?: string[];
  events?: Omit<LifeEvent, 'id'>[];
};

const SEEDS: Seed[] = [
  // Great-grandparents
  {
    id: 'p_emeka',
    firstName: 'Emeka',
    lastName: 'Nwosu',
    gender: 'male',
    birthDate: '1928-04-02',
    deathDate: '2009-11-17',
    birthPlace: 'Enugu, Nigeria',
    occupation: 'Railway engineer',
    bio: 'Kept a notebook of every bridge he ever worked on. The family archive starts with him.',
    events: [
      { date: '1949', title: 'Apprenticed to the Eastern Railway', place: 'Enugu' },
      { date: '1954-01-16', title: 'Marries Amara Obi', place: 'Enugu' },
      { date: '1963', title: 'Builds the Oji river bridge', place: 'Enugu' },
      { date: '1971', title: 'Moves the family to Lagos', place: 'Lagos' },
    ],
  },
  {
    id: 'p_amara',
    firstName: 'Amara',
    lastName: 'Nwosu',
    birthName: 'Obi',
    gender: 'female',
    birthDate: '1931-08-19',
    deathDate: '2016-02-03',
    birthPlace: 'Enugu, Nigeria',
    occupation: 'Schoolteacher',
    bio: 'Taught three generations of children in the same classroom.',
    events: [
      { date: '1952', title: 'Takes the schoolhouse on Ogui Road', place: 'Enugu' },
      { date: '1971', title: 'Moves the family to Lagos', place: 'Lagos' },
      { date: '1994', title: 'Hands the recipe book to Joan' },
    ],
  },
  {
    id: 'p_walter',
    firstName: 'Walter',
    lastName: 'Hart',
    gender: 'male',
    birthDate: '1930-01-11',
    deathDate: '2004-06-28',
    birthPlace: 'Leeds, England',
    occupation: 'Printer',
    events: [
      { date: '1948', title: 'Starts at the Hart & Sons press', place: 'Leeds' },
    ],
  },
  {
    id: 'p_rosalind',
    firstName: 'Rosalind',
    lastName: 'Hart',
    birthName: 'Fairweather',
    nickname: 'Roz',
    gender: 'female',
    birthDate: '1934-05-30',
    deathDate: '2019-09-12',
    birthPlace: 'Leeds, England',
    occupation: 'Midwife',
    bio: 'Delivered over two thousand babies, including two of her own grandchildren.',
    events: [
      { date: '1955', title: 'Qualifies as a midwife', place: 'Leeds' },
      { date: '1956-04-07', title: 'Marries Walter Hart', place: 'Leeds' },
      { date: '1988', title: 'Delivers her own grandchildren', place: 'Manchester' },
    ],
  },

  // Grandparents
  {
    id: 'p_chidi',
    firstName: 'Chidi',
    lastName: 'Nwosu',
    gender: 'male',
    birthDate: '1957-03-14',
    birthPlace: 'Lagos, Nigeria',
    occupation: 'Civil engineer',
    parentIds: ['p_emeka', 'p_amara'],
    events: [
      { date: '1979', title: 'Reads engineering at Manchester', place: 'Manchester' },
      { date: '1983-05-21', title: 'Marries Joan Hart', place: 'Leeds' },
      { date: '1996', title: 'Builds the Salford footbridge', place: 'Manchester' },
    ],
  },
  {
    id: 'p_ifeoma',
    firstName: 'Ifeoma',
    lastName: 'Rivera',
    birthName: 'Nwosu',
    gender: 'female',
    birthDate: '1961-10-05',
    birthPlace: 'Lagos, Nigeria',
    occupation: 'Pharmacist',
    parentIds: ['p_emeka', 'p_amara'],
    events: [
      { date: '1984', title: 'Meets Tomás at a guitar recital', place: 'Seville' },
      { date: '1986-09-13', title: 'Marries Tomás Rivera', place: 'Seville' },
      { date: '1990', title: 'Opens the pharmacy on Calle Feria', place: 'Seville' },
    ],
  },
  {
    id: 'p_joan',
    firstName: 'Joan',
    lastName: 'Nwosu',
    birthName: 'Hart',
    gender: 'female',
    birthDate: '1959-07-22',
    birthPlace: 'Leeds, England',
    occupation: 'Archivist',
    bio: 'Started this family tree on index cards in 1994.',
    parentIds: ['p_walter', 'p_rosalind'],
    events: [
      { date: '1981', title: 'Joins the county archive', place: 'Manchester' },
      { date: '1994', title: 'Starts the family tree on index cards' },
      { date: '2012', title: 'Digitises four shoeboxes of photographs' },
    ],
  },
  {
    id: 'p_peter',
    firstName: 'Peter',
    lastName: 'Hart',
    gender: 'male',
    birthDate: '1962-12-01',
    birthPlace: 'Leeds, England',
    occupation: 'Chef',
    parentIds: ['p_walter', 'p_rosalind'],
    events: [
      { date: '1985', title: 'Trains at the Lowry kitchens', place: 'Manchester' },
      { date: '1999', title: 'Opens a restaurant', place: 'Bristol' },
    ],
  },
  {
    id: 'p_tomas',
    firstName: 'Tomás',
    lastName: 'Rivera',
    gender: 'male',
    birthDate: '1958-02-09',
    birthPlace: 'Seville, Spain',
    occupation: 'Luthier',
    events: [
      { date: '1978', title: 'Apprentices to a luthier', place: 'Seville' },
      { date: '2004', title: 'Builds a guitar for each grandchild' },
    ],
  },
  {
    id: 'p_lena',
    firstName: 'Lena',
    lastName: 'Hart',
    birthName: 'Bauer',
    gender: 'female',
    birthDate: '1965-06-17',
    birthPlace: 'Freiburg, Germany',
    occupation: 'Botanist',
    events: [
      { date: '1989', title: 'Doctorate in alpine botany', place: 'Freiburg' },
      { date: '2003', title: 'Plants the garden at Clifton', place: 'Bristol' },
    ],
  },

  // Parents
  {
    id: 'p_adaeze',
    firstName: 'Adaeze',
    lastName: 'Okafor',
    birthName: 'Nwosu',
    nickname: 'Ada',
    gender: 'female',
    birthDate: '1985-09-08',
    birthPlace: 'Manchester, England',
    occupation: 'Paediatrician',
    bio: 'Keeper of the family recipes and the only one who can read great-grandma Amara’s handwriting.',
    parentIds: ['p_chidi', 'p_joan'],
    events: [
      { date: '2009', title: 'Qualifies in paediatrics', place: 'London' },
      { date: '2010-07-24', title: 'Marries Samuel Okafor', place: 'London' },
      { date: '2018', title: 'Cooks the whole Christmas from Amara’s book' },
    ],
  },
  {
    id: 'p_daniel',
    firstName: 'Daniel',
    lastName: 'Nwosu',
    gender: 'male',
    birthDate: '1988-04-26',
    birthPlace: 'Manchester, England',
    occupation: 'Sound engineer',
    parentIds: ['p_chidi', 'p_joan'],
    events: [
      { date: '2011', title: 'Builds a studio in the attic', place: 'Bristol' },
      { date: '2017', title: 'Meets Mei Lin on a film shoot', place: 'Penang' },
    ],
  },
  {
    id: 'p_samuel',
    firstName: 'Samuel',
    lastName: 'Okafor',
    gender: 'male',
    birthDate: '1983-11-30',
    birthPlace: 'Abuja, Nigeria',
    occupation: 'Architect',
    events: [
      { date: '2007', title: 'Qualifies as an architect', place: 'Abuja' },
      { date: '2013', title: 'Moves the practice to London', place: 'London' },
    ],
  },
  {
    id: 'p_mei',
    firstName: 'Mei Lin',
    lastName: 'Chow',
    gender: 'female',
    birthDate: '1990-01-15',
    birthPlace: 'Penang, Malaysia',
    occupation: 'Illustrator',
  },
  {
    id: 'p_sofia',
    firstName: 'Sofía',
    lastName: 'Rivera',
    gender: 'female',
    birthDate: '1989-03-21',
    birthPlace: 'Seville, Spain',
    occupation: 'Marine biologist',
    parentIds: ['p_tomas', 'p_ifeoma'],
    events: [
      { date: '2014', title: 'First season on the research vessel', place: 'Cádiz' },
      { date: '2021', title: 'Publishes on Mediterranean seagrass' },
    ],
  },
  {
    id: 'p_marco',
    firstName: 'Marco',
    lastName: 'Rivera',
    gender: 'male',
    birthDate: '1992-08-04',
    birthPlace: 'Seville, Spain',
    occupation: 'Teacher',
    parentIds: ['p_tomas', 'p_ifeoma'],
  },
  {
    id: 'p_clara',
    firstName: 'Clara',
    lastName: 'Hart',
    gender: 'female',
    birthDate: '1994-11-11',
    birthPlace: 'Bristol, England',
    occupation: 'Software engineer',
    bio: 'Rebuilt the family tree as an app after one too many arguments at Christmas.',
    parentIds: ['p_peter', 'p_lena'],
    events: [
      { date: '2016', title: 'First engineering job', place: 'Bristol' },
      { date: '2024', title: 'Rebuilds the family tree as an app' },
    ],
  },

  // Children
  {
    id: 'p_zara',
    firstName: 'Zara',
    lastName: 'Okafor',
    gender: 'female',
    birthDate: '2012-06-12',
    birthPlace: 'London, England',
    parentIds: ['p_samuel', 'p_adaeze'],
  },
  {
    id: 'p_noah',
    firstName: 'Noah',
    lastName: 'Okafor',
    gender: 'male',
    birthDate: '2015-10-02',
    birthPlace: 'London, England',
    parentIds: ['p_samuel', 'p_adaeze'],
  },
  {
    id: 'p_kai',
    firstName: 'Kai',
    lastName: 'Nwosu',
    gender: 'male',
    birthDate: '2019-02-28',
    birthPlace: 'Bristol, England',
    parentIds: ['p_daniel', 'p_mei'],
  },
];

const PAIRS: { a: string; b: string; status: UnionStatus; since?: string }[] = [
  { a: 'p_emeka', b: 'p_amara', status: 'widowed', since: '1954-01-16' },
  { a: 'p_walter', b: 'p_rosalind', status: 'widowed', since: '1956-04-07' },
  { a: 'p_chidi', b: 'p_joan', status: 'married', since: '1983-05-21' },
  { a: 'p_tomas', b: 'p_ifeoma', status: 'married', since: '1986-09-13' },
  { a: 'p_peter', b: 'p_lena', status: 'divorced', since: '1990-03-03', },
  { a: 'p_samuel', b: 'p_adaeze', status: 'married', since: '2010-07-24' },
  { a: 'p_daniel', b: 'p_mei', status: 'partners' },
];

/** A small, complete four-generation tree used for first run and for "try it". */
export function createSampleTree(now = Date.now()): FamilyTree {
  const people: Record<string, Person> = {};
  for (const seed of SEEDS) {
    people[seed.id] = {
      ...seed,
      parentIds: seed.parentIds ?? [],
      partnerIds: [],
      events: (seed.events ?? []).map((event, index) => ({ ...event, id: `${seed.id}_e${index}` })),
      createdAt: now,
      updatedAt: now,
    };
  }

  const unions: Record<string, Union> = {};
  for (const pair of PAIRS) {
    if (!people[pair.a] || !people[pair.b]) continue;
    people[pair.a].partnerIds.push(pair.b);
    people[pair.b].partnerIds.push(pair.a);
    const key = keyFor(pair.a, pair.b);
    unions[key] = {
      key,
      partnerIds: [pair.a, pair.b],
      status: pair.status,
      since: pair.since,
    };
  }

  return { name: 'The Nwosu–Hart Family', people, unions, homeId: 'p_adaeze' };
}
