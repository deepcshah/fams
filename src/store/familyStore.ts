import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createSampleTree } from '@/data/sampleFamily';
import { createId } from '@/lib/id';
import { ancestorsOf, descendantsOf } from '@/lib/relations';
import { unionKey, type FamilyTree, type Person, type PersonDraft, type Union, type UnionStatus } from '@/types';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  colorScheme: ColorSchemePreference;
  /** Draw a photo (or initials) on every card. */
  showPortraits: boolean;
  /** Show birth/death years under each name on the canvas. */
  showLifespans: boolean;
};

export type ExportPayload = {
  format: 'fams.tree';
  version: 1;
  exportedAt: string;
  tree: FamilyTree;
};

type State = {
  tree: FamilyTree;
  settings: Settings;
  /** Units whose descendants are hidden on the canvas. */
  collapsedUnitIds: string[];
  /** When set, the canvas shows only this person's lineage. */
  lineageId?: string;
  hydrated: boolean;
};

type Actions = {
  addPerson: (draft: Partial<PersonDraft>) => string;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;

  addRelative: (
    anchorId: string,
    relation: 'parent' | 'child' | 'partner' | 'sibling',
    draft: Partial<PersonDraft>,
    options?: { otherParentId?: string },
  ) => string | null;

  linkParent: (childId: string, parentId: string) => boolean;
  unlinkParent: (childId: string, parentId: string) => void;
  linkPartner: (a: string, b: string, status?: UnionStatus) => boolean;
  unlinkPartner: (a: string, b: string) => void;
  setUnionStatus: (a: string, b: string, status: UnionStatus) => void;

  setHome: (id?: string) => void;
  setLineage: (id?: string) => void;
  toggleCollapsed: (unitId: string) => void;
  expandAll: () => void;
  renameTree: (name: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;

  exportPayload: () => ExportPayload;
  importTree: (raw: string) => { ok: true; count: number } | { ok: false; error: string };
  loadSample: () => void;
  clearTree: () => void;
};

export type FamilyStore = State & Actions;

const defaultSettings: Settings = {
  colorScheme: 'system',
  showPortraits: true,
  showLifespans: true,
};

function emptyPerson(draft: Partial<PersonDraft>, now: number): Person {
  return {
    id: createId(),
    firstName: (draft.firstName ?? '').trim() || 'Unnamed',
    lastName: draft.lastName?.trim() || undefined,
    birthName: draft.birthName?.trim() || undefined,
    nickname: draft.nickname?.trim() || undefined,
    gender: draft.gender ?? 'other',
    birthDate: draft.birthDate || undefined,
    deathDate: draft.deathDate || undefined,
    birthPlace: draft.birthPlace?.trim() || undefined,
    occupation: draft.occupation?.trim() || undefined,
    bio: draft.bio?.trim() || undefined,
    photoUri: draft.photoUri || undefined,
    parentIds: draft.parentIds ? [...draft.parentIds] : [],
    partnerIds: draft.partnerIds ? [...draft.partnerIds] : [],
    createdAt: now,
    updatedAt: now,
  };
}

function withPerson(tree: FamilyTree, person: Person): FamilyTree {
  return { ...tree, people: { ...tree.people, [person.id]: person } };
}

/** A person may not become their own ancestor. */
function wouldCreateCycle(tree: FamilyTree, childId: string, parentId: string): boolean {
  if (childId === parentId) return true;
  return descendantsOf(tree.people, childId).has(parentId) || ancestorsOf(tree.people, parentId).has(childId);
}

function sanitiseTree(input: unknown): FamilyTree | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<FamilyTree>;
  if (!candidate.people || typeof candidate.people !== 'object') return null;

  const now = Date.now();
  const people: Record<string, Person> = {};
  for (const [id, value] of Object.entries(candidate.people as Record<string, unknown>)) {
    const raw = value as Partial<Person>;
    if (!raw || typeof raw !== 'object' || typeof raw.firstName !== 'string') continue;
    people[id] = {
      id,
      firstName: raw.firstName,
      lastName: raw.lastName,
      birthName: raw.birthName,
      nickname: raw.nickname,
      gender: raw.gender === 'female' || raw.gender === 'male' ? raw.gender : 'other',
      birthDate: raw.birthDate,
      deathDate: raw.deathDate,
      birthPlace: raw.birthPlace,
      occupation: raw.occupation,
      bio: raw.bio,
      photoUri: raw.photoUri,
      parentIds: Array.isArray(raw.parentIds) ? raw.parentIds.filter((v) => typeof v === 'string') : [],
      partnerIds: Array.isArray(raw.partnerIds) ? raw.partnerIds.filter((v) => typeof v === 'string') : [],
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    };
  }
  if (Object.keys(people).length === 0) return null;

  // Drop dangling references and make partnerships symmetric.
  for (const person of Object.values(people)) {
    person.parentIds = [...new Set(person.parentIds.filter((id) => id !== person.id && people[id]))];
    person.partnerIds = [...new Set(person.partnerIds.filter((id) => id !== person.id && people[id]))];
  }
  for (const person of Object.values(people)) {
    for (const partnerId of person.partnerIds) {
      if (!people[partnerId].partnerIds.includes(person.id)) people[partnerId].partnerIds.push(person.id);
    }
  }

  const unions: Record<string, Union> = {};
  const rawUnions = (candidate.unions ?? {}) as Record<string, Partial<Union>>;
  for (const person of Object.values(people)) {
    for (const partnerId of person.partnerIds) {
      const key = unionKey(person.id, partnerId);
      if (unions[key]) continue;
      const existing = rawUnions[key];
      unions[key] = {
        key,
        partnerIds: key.split('~') as [string, string],
        status: (existing?.status as UnionStatus) ?? 'married',
        since: existing?.since,
        until: existing?.until,
      };
    }
  }

  const homeId = typeof candidate.homeId === 'string' && people[candidate.homeId] ? candidate.homeId : undefined;
  const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : 'My Family';
  return { name, people, unions, homeId };
}

export const useFamilyStore = create<FamilyStore>()(
  persist(
    (set, get) => ({
      tree: createSampleTree(),
      settings: defaultSettings,
      collapsedUnitIds: [],
      lineageId: undefined,
      hydrated: false,

      addPerson: (draft) => {
        const now = Date.now();
        const person = emptyPerson(draft, now);
        set((state) => ({ tree: withPerson(state.tree, person) }));
        return person.id;
      },

      updatePerson: (id, patch) => {
        set((state) => {
          const existing = state.tree.people[id];
          if (!existing) return state;
          const next: Person = { ...existing, ...patch, id, updatedAt: Date.now() };
          return { tree: withPerson(state.tree, next) };
        });
      },

      deletePerson: (id) => {
        set((state) => {
          if (!state.tree.people[id]) return state;
          const people: Record<string, Person> = {};
          for (const [personId, person] of Object.entries(state.tree.people)) {
            if (personId === id) continue;
            people[personId] = {
              ...person,
              parentIds: person.parentIds.filter((pid) => pid !== id),
              partnerIds: person.partnerIds.filter((pid) => pid !== id),
            };
          }
          const unions: Record<string, Union> = {};
          for (const [key, union] of Object.entries(state.tree.unions)) {
            if (union.partnerIds.includes(id)) continue;
            unions[key] = union;
          }
          const homeId = state.tree.homeId === id ? undefined : state.tree.homeId;
          return {
            tree: { ...state.tree, people, unions, homeId },
            lineageId: state.lineageId === id ? undefined : state.lineageId,
          };
        });
      },

      addRelative: (anchorId, relation, draft, options) => {
        const anchor = get().tree.people[anchorId];
        if (!anchor) return null;
        const now = Date.now();

        if (relation === 'parent') {
          if (anchor.parentIds.length >= 2) return null;
          const parent = emptyPerson(draft, now);
          set((state) => {
            const child = state.tree.people[anchorId];
            if (!child) return state;
            let tree = withPerson(state.tree, parent);
            tree = withPerson(tree, { ...child, parentIds: [...child.parentIds, parent.id], updatedAt: now });
            return { tree };
          });
          // A second parent is assumed to be partnered with the first.
          const otherParentId = anchor.parentIds[0];
          if (otherParentId) get().linkPartner(otherParentId, parent.id);
          return parent.id;
        }

        if (relation === 'child') {
          const parentIds = [anchorId];
          const otherParentId = options?.otherParentId;
          if (otherParentId && get().tree.people[otherParentId]) parentIds.push(otherParentId);
          const child = emptyPerson({ ...draft, parentIds }, now);
          set((state) => ({ tree: withPerson(state.tree, child) }));
          return child.id;
        }

        if (relation === 'partner') {
          const partner = emptyPerson(draft, now);
          set((state) => ({ tree: withPerson(state.tree, partner) }));
          get().linkPartner(anchorId, partner.id);
          return partner.id;
        }

        // sibling
        const sibling = emptyPerson({ ...draft, parentIds: [...anchor.parentIds] }, now);
        set((state) => ({ tree: withPerson(state.tree, sibling) }));
        return sibling.id;
      },

      linkParent: (childId, parentId) => {
        const state = get();
        const child = state.tree.people[childId];
        const parent = state.tree.people[parentId];
        if (!child || !parent) return false;
        if (child.parentIds.includes(parentId)) return true;
        if (child.parentIds.length >= 2) return false;
        if (wouldCreateCycle(state.tree, childId, parentId)) return false;
        set((current) => ({
          tree: withPerson(current.tree, {
            ...current.tree.people[childId],
            parentIds: [...current.tree.people[childId].parentIds, parentId],
            updatedAt: Date.now(),
          }),
        }));
        return true;
      },

      unlinkParent: (childId, parentId) => {
        set((state) => {
          const child = state.tree.people[childId];
          if (!child) return state;
          return {
            tree: withPerson(state.tree, {
              ...child,
              parentIds: child.parentIds.filter((id) => id !== parentId),
              updatedAt: Date.now(),
            }),
          };
        });
      },

      linkPartner: (a, b, status = 'married') => {
        const state = get();
        if (a === b) return false;
        const personA = state.tree.people[a];
        const personB = state.tree.people[b];
        if (!personA || !personB) return false;
        if (personA.partnerIds.includes(b)) return true;
        const key = unionKey(a, b);
        set((current) => {
          const nextA = { ...current.tree.people[a] };
          const nextB = { ...current.tree.people[b] };
          nextA.partnerIds = [...nextA.partnerIds, b];
          nextB.partnerIds = [...nextB.partnerIds, a];
          nextA.updatedAt = Date.now();
          nextB.updatedAt = nextA.updatedAt;
          let tree = withPerson(current.tree, nextA);
          tree = withPerson(tree, nextB);
          tree = {
            ...tree,
            unions: {
              ...tree.unions,
              [key]: { key, partnerIds: key.split('~') as [string, string], status },
            },
          };
          return { tree };
        });
        return true;
      },

      unlinkPartner: (a, b) => {
        set((state) => {
          const personA = state.tree.people[a];
          const personB = state.tree.people[b];
          if (!personA || !personB) return state;
          const now = Date.now();
          let tree = withPerson(state.tree, {
            ...personA,
            partnerIds: personA.partnerIds.filter((id) => id !== b),
            updatedAt: now,
          });
          tree = withPerson(tree, {
            ...personB,
            partnerIds: personB.partnerIds.filter((id) => id !== a),
            updatedAt: now,
          });
          const unions = { ...tree.unions };
          delete unions[unionKey(a, b)];
          return { tree: { ...tree, unions } };
        });
      },

      setUnionStatus: (a, b, status) => {
        set((state) => {
          const key = unionKey(a, b);
          const existing = state.tree.unions[key];
          if (!existing) return state;
          return {
            tree: { ...state.tree, unions: { ...state.tree.unions, [key]: { ...existing, status } } },
          };
        });
      },

      setHome: (id) => set((state) => ({ tree: { ...state.tree, homeId: id } })),
      setLineage: (id) => set({ lineageId: id }),

      toggleCollapsed: (unitId) =>
        set((state) => ({
          collapsedUnitIds: state.collapsedUnitIds.includes(unitId)
            ? state.collapsedUnitIds.filter((id) => id !== unitId)
            : [...state.collapsedUnitIds, unitId],
        })),

      expandAll: () => set({ collapsedUnitIds: [] }),

      renameTree: (name) => set((state) => ({ tree: { ...state.tree, name: name.trim() || 'My Family' } })),

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      exportPayload: () => ({
        format: 'fams.tree',
        version: 1,
        exportedAt: new Date().toISOString(),
        tree: get().tree,
      }),

      importTree: (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { ok: false, error: 'That file is not valid JSON.' };
        }
        const container = parsed as { tree?: unknown };
        const tree = sanitiseTree(container?.tree ?? parsed);
        if (!tree) return { ok: false, error: 'No people found in that file.' };
        set({ tree, collapsedUnitIds: [], lineageId: undefined });
        return { ok: true, count: Object.keys(tree.people).length };
      },

      loadSample: () => {
        const tree = createSampleTree();
        set({ tree, collapsedUnitIds: [], lineageId: undefined });
      },

      clearTree: () =>
        set({
          tree: { name: 'My Family', people: {}, unions: {}, homeId: undefined },
          collapsedUnitIds: [],
          lineageId: undefined,
        }),
    }),
    {
      name: 'fams.store.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tree: state.tree,
        settings: state.settings,
        collapsedUnitIds: state.collapsedUnitIds,
        lineageId: state.lineageId,
      }),
    },
  ),
);

// `hydrated` is deliberately not persisted; it flips once storage has been read
// so the UI can hold the splash instead of flashing the sample tree.
useFamilyStore.persist.onFinishHydration(() => useFamilyStore.setState({ hydrated: true }));
if (useFamilyStore.persist.hasHydrated()) useFamilyStore.setState({ hydrated: true });
