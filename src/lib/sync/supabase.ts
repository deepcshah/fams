import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { File as FsFile } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Tombstones } from '../merge';
import type { FamilyTree, Person, Union } from '../../types';

import {
  toRemotePhoto,
  type AuthUser,
  type Invite,
  type Member,
  type PushPayload,
  type RemoteSnapshot,
  type RemoteTree,
  type Role,
  type SyncAdapter,
} from './types';

const BUCKET = 'portraits';

function extensionOf(uri: string): string {
  const match = /\.([A-Za-z0-9]{1,5})(?:\?|#|$)/.exec(uri);
  return (match?.[1] ?? 'jpg').toLowerCase();
}

function contentTypeFor(extension: string): string {
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  return 'image/jpeg';
}

/** Reads a local image into bytes, whichever platform produced the URI. */
async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new FsFile(uri).arrayBuffer();
}

function userOf(raw: { id: string; email?: string } | null | undefined): AuthUser | null {
  return raw ? { id: raw.id, email: raw.email ?? undefined } : null;
}

export class SupabaseAdapter implements SyncAdapter {
  readonly label = 'Supabase';

  constructor(private readonly client: SupabaseClient) {}

  // ----------------------------------------------------------------- auth ---

  async getUser(): Promise<AuthUser | null> {
    const { data } = await this.client.auth.getUser();
    return userOf(data.user as { id: string; email?: string } | null);
  }

  onAuthChange(listener: (user: AuthUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(userOf(session?.user as { id: string; email?: string } | undefined));
    });
    return () => data.subscription.unsubscribe();
  }

  async sendCode(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);
  }

  async verifyCode(email: string, token: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    });
    if (error) throw new Error(error.message);
    const user = userOf(data.user as { id: string; email?: string } | null);
    if (!user) throw new Error('That code did not work. Ask for a new one.');
    return user;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  // ---------------------------------------------------------------- trees ---

  async acceptInvites(): Promise<string[]> {
    const { data, error } = await this.client.rpc('accept_tree_invites');
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? (data as string[]) : [];
  }

  async listTrees(): Promise<RemoteTree[]> {
    const { data, error } = await this.client
      .from('tree_members')
      .select('role, trees!inner(id, name, updated_at)')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const tree = row.trees as unknown as { id: string; name: string; updated_at: string };
      return {
        id: tree.id,
        name: tree.name,
        role: row.role as Role,
        updatedAt: Date.parse(tree.updated_at) || 0,
      };
    });
  }

  async createTree(name: string): Promise<RemoteTree> {
    const { data: auth } = await this.client.auth.getUser();
    if (!auth.user) throw new Error('Sign in first.');
    const { data, error } = await this.client
      .from('trees')
      .insert({ name, owner_id: auth.user.id })
      .select('id, name, updated_at')
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id, name: data.name, role: 'owner', updatedAt: Date.parse(data.updated_at) || 0 };
  }

  async deleteTree(treeId: string): Promise<void> {
    const { error } = await this.client.from('trees').delete().eq('id', treeId);
    if (error) throw new Error(error.message);
  }

  async leaveTree(treeId: string): Promise<void> {
    const { data: auth } = await this.client.auth.getUser();
    if (!auth.user) return;
    const { error } = await this.client
      .from('tree_members')
      .delete()
      .eq('tree_id', treeId)
      .eq('user_id', auth.user.id);
    if (error) throw new Error(error.message);
  }

  // ----------------------------------------------------------------- data ---

  async pull(treeId: string): Promise<RemoteSnapshot> {
    const [treeResult, peopleResult, unionsResult] = await Promise.all([
      this.client.from('trees').select('name, home_person_id, updated_at').eq('id', treeId).single(),
      this.client.from('people').select('id, data, updated_at, deleted_at').eq('tree_id', treeId),
      this.client.from('unions').select('key, data, updated_at, deleted_at').eq('tree_id', treeId),
    ]);
    if (treeResult.error) throw new Error(treeResult.error.message);
    if (peopleResult.error) throw new Error(peopleResult.error.message);
    if (unionsResult.error) throw new Error(unionsResult.error.message);

    const people: Record<string, Person> = {};
    const unions: Record<string, Union> = {};
    const tombstones: Tombstones = {};

    for (const row of peopleResult.data ?? []) {
      if (row.deleted_at) {
        tombstones[row.id] = Number(row.deleted_at);
        continue;
      }
      people[row.id] = { ...(row.data as Person), id: row.id, updatedAt: Number(row.updated_at) };
    }
    for (const row of unionsResult.data ?? []) {
      if (row.deleted_at) {
        tombstones[row.key] = Number(row.deleted_at);
        continue;
      }
      unions[row.key] = { ...(row.data as Union), key: row.key, updatedAt: Number(row.updated_at) };
    }

    const tree: FamilyTree = {
      name: treeResult.data.name,
      people,
      unions,
      homeId: treeResult.data.home_person_id ?? undefined,
    };
    return { tree, tombstones, updatedAt: Date.parse(treeResult.data.updated_at) || 0 };
  }

  async push(treeId: string, payload: PushPayload): Promise<void> {
    const now = new Date().toISOString();

    if (payload.people.length > 0) {
      const { error } = await this.client.from('people').upsert(
        payload.people.map((person) => ({
          tree_id: treeId,
          id: person.id,
          data: person,
          updated_at: person.updatedAt,
          deleted_at: null,
        })),
      );
      if (error) throw new Error(error.message);
    }

    if (payload.unions.length > 0) {
      const { error } = await this.client.from('unions').upsert(
        payload.unions.map((union) => ({
          tree_id: treeId,
          key: union.key,
          data: union,
          updated_at: union.updatedAt ?? 0,
          deleted_at: null,
        })),
      );
      if (error) throw new Error(error.message);
    }

    // A deletion is a row with a tombstone, not a missing row: the other
    // devices have to learn that it happened.
    for (const tombstone of payload.tombstones) {
      const table = tombstone.id.includes('~') ? 'unions' : 'people';
      const keyColumn = table === 'unions' ? 'key' : 'id';
      const { error } = await this.client
        .from(table)
        .upsert({ tree_id: treeId, [keyColumn]: tombstone.id, data: {}, updated_at: tombstone.at, deleted_at: tombstone.at });
      if (error) throw new Error(error.message);
    }

    const { error } = await this.client
      .from('trees')
      .update({ name: payload.name, home_person_id: payload.homeId ?? null, updated_at: now })
      .eq('id', treeId);
    if (error) throw new Error(error.message);
  }

  // -------------------------------------------------------------- sharing ---

  async listMembers(treeId: string): Promise<{ members: Member[]; invites: Invite[] }> {
    const { data: auth } = await this.client.auth.getUser();
    const [memberResult, inviteResult] = await Promise.all([
      this.client.from('tree_members').select('user_id, email, role').eq('tree_id', treeId),
      this.client.from('tree_invites').select('id, email, role').eq('tree_id', treeId).is('accepted_at', null),
    ]);
    if (memberResult.error) throw new Error(memberResult.error.message);
    if (inviteResult.error) throw new Error(inviteResult.error.message);

    return {
      members: (memberResult.data ?? []).map((row) => ({
        userId: row.user_id,
        email: row.email ?? undefined,
        role: row.role as Role,
        isYou: row.user_id === auth.user?.id,
      })),
      invites: (inviteResult.data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as Role,
      })),
    };
  }

  async invite(treeId: string, email: string, role: Role): Promise<void> {
    const { data: auth } = await this.client.auth.getUser();
    const { error } = await this.client
      .from('tree_invites')
      .upsert(
        { tree_id: treeId, email: email.trim().toLowerCase(), role, invited_by: auth.user?.id ?? null, accepted_at: null },
        { onConflict: 'tree_id,email' },
      );
    if (error) throw new Error(error.message);
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await this.client.from('tree_invites').delete().eq('id', inviteId);
    if (error) throw new Error(error.message);
  }

  async setRole(treeId: string, userId: string, role: Role): Promise<void> {
    const { error } = await this.client
      .from('tree_members')
      .update({ role })
      .eq('tree_id', treeId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  async removeMember(treeId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('tree_members')
      .delete()
      .eq('tree_id', treeId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  // --------------------------------------------------------------- photos ---

  async uploadPhoto(treeId: string, personId: string, localUri: string): Promise<string> {
    const extension = extensionOf(localUri);
    const path = `${treeId}/${personId}/${Date.now().toString(36)}.${extension}`;
    const bytes = await readBytes(localUri);
    const { error } = await this.client.storage.from(BUCKET).upload(path, bytes, {
      contentType: contentTypeFor(extension),
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return toRemotePhoto(path);
  }

  async resolvePhoto(path: string): Promise<string | null> {
    const { data, error } = await this.client.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
    if (error) return null;
    return data?.signedUrl ?? null;
  }
}

/**
 * The app is local-first and must run with no backend at all, so configuration
 * is optional and its absence is a supported state rather than a crash.
 */
export function createSupabaseAdapter(url?: string, anonKey?: string): SyncAdapter | null {
  if (!url || !anonKey) return null;

  // Hermes needs a URL implementation supabase-js can rely on. Browsers and the
  // Node pass that prerenders the web build already have one, and loading the
  // polyfill there reaches for `window`, which the server does not have — so it
  // is required here, lazily, rather than imported at the top.
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-url-polyfill/auto');
  }
  const client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // There is no URL to read a session back from outside the browser.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return new SupabaseAdapter(client);
}
