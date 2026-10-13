import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useFamilyStore } from '@/store/familyStore';
import { useSyncStore } from '@/store/syncStore';

const DEBOUNCE_MS = 2500;

/**
 * Keeps the server roughly in step with the local store without ever being in
 * the way: edits settle for a couple of seconds before a sync is attempted,
 * and the app also syncs when it comes back to the foreground. Nothing here
 * blocks rendering, and a failure only means the copy upstairs is stale.
 */
export function SyncBridge() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    useSyncStore.getState().init();
  }, []);

  useEffect(() => {
    const unsubscribe = useFamilyStore.subscribe((state, previous) => {
      if (state.tree === previous.tree && state.tombstones === previous.tombstones) return;
      const { user, activeTreeId, role } = useSyncStore.getState();
      if (!user || !activeTreeId || role === 'viewer') return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        useSyncStore.getState().syncNow();
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const { user, activeTreeId } = useSyncStore.getState();
      if (user && activeTreeId) useSyncStore.getState().syncNow();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
