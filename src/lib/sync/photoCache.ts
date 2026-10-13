import { isRemotePhoto, remotePhotoPath } from './types';
import { getSync } from './index';

/**
 * Signed URLs expire, so resolved links are cached only for as long as they are
 * good for. Keyed by storage path, shared across every component that happens
 * to show the same photograph.
 */
const TTL_MS = 5 * 60 * 60 * 1000;
const cache = new Map<string, { url: string; expires: number }>();
const inFlight = new Map<string, Promise<string | null>>();

export async function resolvePhotoUri(uri?: string): Promise<string | undefined> {
  if (!uri) return undefined;
  if (!isRemotePhoto(uri)) return uri;
  const sync = getSync();
  if (!sync) return undefined;

  const path = remotePhotoPath(uri);
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;

  // Twenty cards showing the same photograph must not sign twenty URLs.
  let pending = inFlight.get(path);
  if (!pending) {
    pending = sync.resolvePhoto(path).finally(() => inFlight.delete(path));
    inFlight.set(path, pending);
  }

  const url = await pending;
  if (!url) return undefined;
  cache.set(path, { url, expires: Date.now() + TTL_MS });
  return url;
}

export function clearPhotoCache(): void {
  cache.clear();
  inFlight.clear();
}
