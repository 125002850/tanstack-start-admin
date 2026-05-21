export type PageCacheScope = string;

export interface PageCacheSnapshot {
  version: 1;
  updatedAt: number;
  slots: Record<string, unknown>;
}

export interface PageCacheStorageAdapter {
  loadSnapshot(scope: string): PageCacheSnapshot | null;
  saveSnapshot(scope: string, snapshot: PageCacheSnapshot): void;
  deleteSnapshot(scope: string): void;
}

export interface PageCacheProviderProps {
  scope: string;
  children: React.ReactNode;
  storage?: 'session';
  maxAgeMs?: number;
}

export interface PageCacheContextValue {
  scope: string;
  readSlot<T>(slot: string): T | undefined;
  writeSlot<T>(slot: string, value: T): void;
  deleteSlot(slot: string): void;
}
