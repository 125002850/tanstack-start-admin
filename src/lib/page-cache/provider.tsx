import { createContext, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { PageCacheContextValue, PageCacheProviderProps, PageCacheSnapshot } from './types';
import { createSessionStorageAdapter } from './storage';

export const PageCacheContext = createContext<PageCacheContextValue | null>(null);

export function PageCacheProvider({
  scope,
  children,
  storage = 'session',
  maxAgeMs
}: PageCacheProviderProps & { children: ReactNode }) {
  const adapterRef = useRef(
    storage === 'session'
      ? createSessionStorageAdapter(maxAgeMs)
      : createSessionStorageAdapter(maxAgeMs)
  );

  const value: PageCacheContextValue = useMemo(
    () => ({
      scope,

      readSlot<T>(slot: string): T | undefined {
        const snapshot = adapterRef.current.loadSnapshot(scope);
        return snapshot?.slots[slot] as T | undefined;
      },

      writeSlot<T>(slot: string, value: T): void {
        const existing = adapterRef.current.loadSnapshot(scope);
        const snapshot: PageCacheSnapshot = existing
          ? { ...existing, slots: { ...existing.slots, [slot]: value }, updatedAt: Date.now() }
          : { version: 1, updatedAt: Date.now(), slots: { [slot]: value } };
        adapterRef.current.saveSnapshot(scope, snapshot);
      },

      deleteSlot(slot: string): void {
        const existing = adapterRef.current.loadSnapshot(scope);
        if (!existing) return;
        const next = { ...existing.slots };
        delete next[slot];

        if (Object.keys(next).length === 0) {
          adapterRef.current.deleteSnapshot(scope);
          return;
        }

        adapterRef.current.saveSnapshot(scope, { ...existing, slots: next, updatedAt: Date.now() });
      }
    }),
    [scope]
  );

  return <PageCacheContext.Provider value={value}>{children}</PageCacheContext.Provider>;
}
