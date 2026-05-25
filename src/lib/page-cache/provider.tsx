import { createContext, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { PageCacheContextValue, PageCacheProviderProps, PageCacheSnapshot } from './types';
import { createMemoryStorageAdapter, createSessionStorageAdapter } from './storage';

export const PageCacheContext = createContext<PageCacheContextValue | null>(null);

export function PageCacheProvider({
  scope,
  children,
  persist = true,
  storage = 'session',
  maxAgeMs
}: PageCacheProviderProps & { children: ReactNode }) {
  const adapter = useMemo(() => {
    if (!persist) {
      return createMemoryStorageAdapter(maxAgeMs);
    }

    return createSessionStorageAdapter(maxAgeMs);
  }, [maxAgeMs, persist]);
  const cachedScopeRef = useRef<string | null>(null);
  const cachedSnapshotRef = useRef<PageCacheSnapshot | null>(null);

  const value: PageCacheContextValue = useMemo(() => {
    const readSnapshot = () => {
      if (cachedScopeRef.current !== scope) {
        cachedSnapshotRef.current = adapter.loadSnapshot(scope);
        cachedScopeRef.current = scope;
      }

      return cachedSnapshotRef.current;
    };

    const writeSnapshot = (snapshot: PageCacheSnapshot | null) => {
      cachedScopeRef.current = scope;
      cachedSnapshotRef.current = snapshot;

      if (!snapshot) {
        adapter.deleteSnapshot(scope);
        return;
      }

      adapter.saveSnapshot(scope, snapshot);
    };

    return {
      scope,

      readSlot<T>(slot: string): T | undefined {
        const snapshot = readSnapshot();
        return snapshot?.slots[slot] as T | undefined;
      },

      writeSlot<T>(slot: string, value: T): void {
        const existing = readSnapshot();
        const snapshot: PageCacheSnapshot = existing
          ? { ...existing, slots: { ...existing.slots, [slot]: value }, updatedAt: Date.now() }
          : { version: 1, updatedAt: Date.now(), slots: { [slot]: value } };

        writeSnapshot(snapshot);
      },

      deleteSlot(slot: string): void {
        const existing = readSnapshot();
        if (!existing) return;

        const next = { ...existing.slots };
        delete next[slot];

        if (Object.keys(next).length === 0) {
          writeSnapshot(null);
          return;
        }

        writeSnapshot({ ...existing, slots: next, updatedAt: Date.now() });
      }
    };
  }, [adapter, scope]);

  if (storage !== 'session') {
    throw new Error(`Unsupported page cache storage: ${storage}`);
  }

  return <PageCacheContext.Provider value={value}>{children}</PageCacheContext.Provider>;
}
