import type { Tombstones } from '../merge';
import type { FamilyTree, Person, Union } from '../../types';

export type Role = 'owner' | 'editor' | 'viewer';

export type AuthUser = { id: string; email?: string };

export type RemoteTree = {
  id: string;
  name: string;
  role: Role;
  updatedAt: number;
  memberCount?: number;
};

export type Member = { userId: string; email?: string; role: Role; isYou: boolean };
export type Invite = { id: string; email: string; role: Role };

export type RemoteSnapshot = { tree: FamilyTree; tombstones: Tombstones; updatedAt: number };

export type PushPayload = {
  name: string;
  homeId?: string;
  updatedAt: number;
  people: Person[];
  unions: Union[];
  tombstones: { id: string; at: number }[];
};

/**
 * Everything the app needs from a backend, in one place. The implementation
 * below is Supabase; keeping the surface this narrow is what makes that a
 * choice rather than a commitment.
 */
export interface SyncAdapter {
  readonly label: string;

  getUser(): Promise<AuthUser | null>;
  onAuthChange(listener: (user: AuthUser | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, token: string): Promise<AuthUser>;
  signOut(): Promise<void>;

  /** Joins any tree this account has been invited to. Returns their ids. */
  acceptInvites(): Promise<string[]>;

  listTrees(): Promise<RemoteTree[]>;
  createTree(name: string): Promise<RemoteTree>;
  deleteTree(treeId: string): Promise<void>;
  leaveTree(treeId: string): Promise<void>;

  pull(treeId: string): Promise<RemoteSnapshot>;
  push(treeId: string, payload: PushPayload): Promise<void>;

  listMembers(treeId: string): Promise<{ members: Member[]; invites: Invite[] }>;
  invite(treeId: string, email: string, role: Role): Promise<void>;
  revokeInvite(inviteId: string): Promise<void>;
  setRole(treeId: string, userId: string, role: Role): Promise<void>;
  removeMember(treeId: string, userId: string): Promise<void>;

  /** Uploads a local image and returns the storage path to persist. */
  uploadPhoto(treeId: string, personId: string, localUri: string): Promise<string>;
  /** Turns a stored path back into something an <Image> can load. */
  resolvePhoto(path: string): Promise<string | null>;
}

/** Stored photo references are tagged so they can be told from local URIs. */
export const REMOTE_PHOTO_PREFIX = 'fams-storage:';

export function isRemotePhoto(uri?: string): boolean {
  return Boolean(uri?.startsWith(REMOTE_PHOTO_PREFIX));
}

export function remotePhotoPath(uri: string): string {
  return uri.slice(REMOTE_PHOTO_PREFIX.length);
}

export function toRemotePhoto(path: string): string {
  return `${REMOTE_PHOTO_PREFIX}${path}`;
}
