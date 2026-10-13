import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mergeTrees } from '@/lib/merge';
import { getSync, syncConfigured, type AuthUser, type Invite, type Member, type RemoteTree, type Role } from '@/lib/sync';
import { isRemotePhoto } from '@/lib/sync/types';
import { useFamilyStore } from '@/store/familyStore';
import type { Person } from '@/types';

export type SyncStatus = 'offline' | 'idle' | 'working' | 'error';

type State = {
  configured: boolean;
  user: AuthUser | null;
  status: SyncStatus;
  /** Shown verbatim in the UI; never a raw stack. */
  message?: string;
  error?: string;
  trees: RemoteTree[];
  activeTreeId?: string;
  role?: Role;
  lastSyncedAt?: number;
  /** Set between asking for a code and verifying it. */
  awaitingCodeFor?: string;
  hydrated: boolean;
};

type Actions = {
  init: () => Promise<void>;
  sendCode: (email: string) => Promise<boolean>;
  verifyCode: (code: string) => Promise<boolean>;
  cancelCode: () => void;
  signOut: () => Promise<void>;

  refreshTrees: () => Promise<void>;
  publishCurrentTree: (name: string) => Promise<void>;
  connectTree: (treeId: string) => Promise<void>;
  disconnect: () => void;
  leaveTree: (treeId: string) => Promise<void>;

  syncNow: () => Promise<void>;

  loadMembers: (treeId: string) => Promise<{ members: Member[]; invites: Invite[] }>;
  invite: (treeId: string, email: string, role: Role) => Promise<void>;
  revokeInvite: (inviteId: string) => Promise<void>;
  setRole: (treeId: string, userId: string, role: Role) => Promise<void>;
  removeMember: (treeId: string, userId: string) => Promise<void>;
};

export type SyncStore = State & Actions;

function describe(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/fetch|network|Failed to fetch/i.test(text)) return 'Could not reach the server. Your work is saved on this device.';
  return text;
}

/** Photographs still sitting on this device, which the server has never seen. */
function localPhotosOf(people: Person[]): Person[] {
  return people.filter((person) => person.photoUri && !isRemotePhoto(person.photoUri));
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      configured: syncConfigured,
      user: null,
      status: syncConfigured ? 'idle' : 'offline',
      trees: [],
      hydrated: false,

      init: async () => {
        const sync = getSync();
        if (!sync) return;
        try {
          const user = await sync.getUser();
          set({ user });
          sync.onAuthChange((next) => {
            set({ user: next });
            if (!next) set({ trees: [], activeTreeId: undefined, role: undefined });
          });
          if (user) {
            await sync.acceptInvites().catch(() => []);
            await get().refreshTrees();
            if (get().activeTreeId) await get().syncNow();
          }
        } catch (error) {
          set({ status: 'error', error: describe(error) });
        }
      },

      sendCode: async (email) => {
        const sync = getSync();
        if (!sync) return false;
        set({ status: 'working', error: undefined, message: undefined });
        try {
          await sync.sendCode(email);
          set({ status: 'idle', awaitingCodeFor: email.trim(), message: `We sent a sign-in code to ${email.trim()}.` });
          return true;
        } catch (error) {
          set({ status: 'error', error: describe(error) });
          return false;
        }
      },

      verifyCode: async (code) => {
        const email = get().awaitingCodeFor;
        const sync = getSync();
        if (!sync || !email) return false;
        set({ status: 'working', error: undefined });
        try {
          const user = await sync.verifyCode(email, code);
          set({ user, awaitingCodeFor: undefined, status: 'idle', message: undefined });
          await sync.acceptInvites().catch(() => []);
          await get().refreshTrees();
          return true;
        } catch (error) {
          set({ status: 'error', error: describe(error) });
          return false;
        }
      },

      cancelCode: () => set({ awaitingCodeFor: undefined, message: undefined, error: undefined }),

      signOut: async () => {
        const sync = getSync();
        if (!sync) return;
        await sync.signOut().catch(() => {});
        set({ user: null, trees: [], activeTreeId: undefined, role: undefined, lastSyncedAt: undefined, status: 'idle' });
      },

      refreshTrees: async () => {
        const sync = getSync();
        if (!sync || !get().user) return;
        try {
          const trees = await sync.listTrees();
          const active = get().activeTreeId;
          set({
            trees,
            role: trees.find((tree) => tree.id === active)?.role,
            // The tree may have been deleted, or we may have been removed.
            activeTreeId: trees.some((tree) => tree.id === active) ? active : undefined,
          });
        } catch (error) {
          set({ status: 'error', error: describe(error) });
        }
      },

      publishCurrentTree: async (name) => {
        const sync = getSync();
        if (!sync || !get().user) return;
        set({ status: 'working', error: undefined });
        try {
          const remote = await sync.createTree(name);
          set({ activeTreeId: remote.id, role: 'owner' });
          await get().refreshTrees();
          await get().syncNow();
          set({ message: `“${remote.name}” is now backed up and shareable.` });
        } catch (error) {
          set({ status: 'error', error: describe(error) });
        }
      },

      connectTree: async (treeId) => {
        const sync = getSync();
        if (!sync) return;
        set({ activeTreeId: treeId, role: get().trees.find((tree) => tree.id === treeId)?.role });
        await get().syncNow();
      },

      disconnect: () => set({ activeTreeId: undefined, role: undefined, lastSyncedAt: undefined }),

      leaveTree: async (treeId) => {
        const sync = getSync();
        if (!sync) return;
        try {
          await sync.leaveTree(treeId);
          if (get().activeTreeId === treeId) get().disconnect();
          await get().refreshTrees();
        } catch (error) {
          set({ status: 'error', error: describe(error) });
        }
      },

      /**
       * Pull, merge, write back, push. The local store stays the source of
       * truth for rendering throughout, so a failure here never costs anybody
       * their work — it just means the copy upstairs is stale.
       */
      syncNow: async () => {
        const treeId = get().activeTreeId;
        const sync = getSync();
        if (!sync || !get().user || !treeId) return;
        if (get().status === 'working') return;
        set({ status: 'working', error: undefined });

        try {
          const family = useFamilyStore.getState();
          const readOnly = get().role === 'viewer';

          // Photographs first: a Person row must never reference a file that
          // only exists on this phone.
          if (!readOnly) {
            for (const person of localPhotosOf(Object.values(family.tree.people))) {
              try {
                const stored = await sync.uploadPhoto(treeId, person.id, person.photoUri!);
                useFamilyStore.getState().updatePerson(person.id, { photoUri: stored });
              } catch {
                // An unreadable local file should not stall the whole sync.
              }
            }
          }

          const local = useFamilyStore.getState();
          const remote = await sync.pull(treeId);
          const merged = mergeTrees(
            { tree: local.tree, tombstones: local.tombstones, updatedAt: local.treeUpdatedAt },
            remote,
          );

          useFamilyStore.getState().applyMerged(merged.tree, merged.tombstones, merged.updatedAt);

          if (!readOnly) {
            const people = merged.push.personIds
              .map((id) => merged.tree.people[id])
              .filter((person): person is Person => Boolean(person));
            const unions = merged.push.unionKeys.map((key) => merged.tree.unions[key]).filter(Boolean);
            const tombstones = merged.push.tombstones.map((id) => ({ id, at: merged.tombstones[id] }));

            if (people.length > 0 || unions.length > 0 || tombstones.length > 0 || merged.updatedAt === local.treeUpdatedAt) {
              await sync.push(treeId, {
                name: merged.tree.name,
                homeId: merged.tree.homeId,
                updatedAt: merged.updatedAt,
                people,
                unions,
                tombstones,
              });
            }
          }

          set({
            status: 'idle',
            lastSyncedAt: Date.now(),
            message:
              merged.overwritten.length > 0
                ? `Updated from the server: ${merged.overwritten.slice(0, 3).join(', ')}${
                    merged.overwritten.length > 3 ? ` and ${merged.overwritten.length - 3} more` : ''
                  }.`
                : undefined,
          });
        } catch (error) {
          set({ status: 'error', error: describe(error) });
        }
      },

      loadMembers: async (treeId) => {
        const sync = getSync();
        if (!sync) return { members: [], invites: [] };
        return sync.listMembers(treeId);
      },

      invite: async (treeId, email, role) => {
        const sync = getSync();
        if (!sync) return;
        try {
          await sync.invite(treeId, email, role);
          set({ message: `Invited ${email.trim()}. They'll join when they sign in with that address.` });
        } catch (error) {
          set({ status: 'error', error: describe(error) });
        }
      },

      revokeInvite: async (inviteId) => {
        await getSync()?.revokeInvite(inviteId).catch((error) => set({ error: describe(error) }));
      },

      setRole: async (treeId, userId, role) => {
        await getSync()?.setRole(treeId, userId, role).catch((error) => set({ error: describe(error) }));
      },

      removeMember: async (treeId, userId) => {
        await getSync()?.removeMember(treeId, userId).catch((error) => set({ error: describe(error) }));
      },
    }),
    {
      name: 'fams.sync.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeTreeId: state.activeTreeId }),
    },
  ),
);

useSyncStore.persist.onFinishHydration(() => useSyncStore.setState({ hydrated: true }));
if (useSyncStore.persist.hasHydrated()) useSyncStore.setState({ hydrated: true });
