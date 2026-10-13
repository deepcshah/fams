import { createSupabaseAdapter } from './supabase';
import type { SyncAdapter } from './types';

const URL_ENV = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY_ENV = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Configuration is optional on purpose: with no credentials the app is exactly
 * what it was before — local-first, on-device, fully usable — and every cloud
 * affordance simply hides itself.
 */
export const syncConfigured = Boolean(URL_ENV && KEY_ENV);

let adapter: SyncAdapter | null | undefined;

/**
 * Built on first use rather than at import. The web build is prerendered in
 * Node, where there is no browser to hold a session and nothing to sync, so the
 * client must not be constructed just because the module was loaded.
 */
export function getSync(): SyncAdapter | null {
  if (!syncConfigured) return null;
  if (typeof window === 'undefined') return null;
  if (adapter === undefined) adapter = createSupabaseAdapter(URL_ENV, KEY_ENV);
  return adapter;
}

export * from './types';
