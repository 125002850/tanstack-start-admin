import type { PageCacheSnapshot, PageCacheStorageAdapter } from './types';

const STORAGE_KEY = 'app-page-cache-v1';
const MAX_SCOPES = 20;

function getSafeSessionStorage(): Storage | undefined {
  try {
    if (typeof window !== 'undefined' && typeof window.sessionStorage === 'object') {
      return window.sessionStorage;
    }
  } catch {
    // sessionStorage unavailable
  }
  return undefined;
}

type ScopeMap = Record<string, PageCacheSnapshot>;
type StorageOptions = {
  maxAgeMs?: number;
};

function loadScopeMap(): ScopeMap {
  const storage = getSafeSessionStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ScopeMap;
  } catch {
    return {};
  }
}

function saveScopeMap(map: ScopeMap): void {
  const storage = getSafeSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota exceeded or write blocked — degrade silently
  }
}

function pruneScopeMap(map: ScopeMap): ScopeMap {
  const entries = Object.entries(map);
  if (entries.length <= MAX_SCOPES) return map;

  const sorted = entries.toSorted((a, b) => a[1].updatedAt - b[1].updatedAt);
  const keep = sorted.slice(entries.length - MAX_SCOPES);
  return Object.fromEntries(keep);
}

function createMaxAgePruner(maxAgeMs: number) {
  return (map: ScopeMap): ScopeMap => {
    const now = Date.now();
    const result: ScopeMap = {};
    for (const [scope, snapshot] of Object.entries(map)) {
      if (now - snapshot.updatedAt <= maxAgeMs) {
        result[scope] = snapshot;
      }
    }
    return result;
  };
}

function enforceMaxAge(map: ScopeMap, maxAgeMs: number): ScopeMap {
  const pruner = createMaxAgePruner(maxAgeMs);
  const pruned = pruner(map);
  if (Object.keys(pruned).length !== Object.keys(map).length) {
    saveScopeMap(pruned);
  }
  return pruned;
}

function loadPageCacheScopes({ maxAgeMs }: StorageOptions = {}): ScopeMap {
  let map = loadScopeMap();

  if (maxAgeMs) {
    map = enforceMaxAge(map, maxAgeMs);
  }

  return map;
}

function savePageCacheScopes(map: ScopeMap, { maxAgeMs }: StorageOptions = {}): void {
  let pruned = pruneScopeMap(map);

  if (maxAgeMs) {
    pruned = createMaxAgePruner(maxAgeMs)(pruned);
  }

  saveScopeMap(pruned);
}

function loadPageCacheSnapshot(scope: string, options?: StorageOptions): PageCacheSnapshot | null {
  const map = loadPageCacheScopes(options);
  return map[scope] ?? null;
}

function savePageCacheSnapshot(
  scope: string,
  snapshot: PageCacheSnapshot,
  options?: StorageOptions
): void {
  const map = loadScopeMap();
  map[scope] = snapshot;
  savePageCacheScopes(map, options);
}

export function createSessionStorageAdapter(maxAgeMs?: number): PageCacheStorageAdapter {
  return {
    loadSnapshot(scope) {
      return loadPageCacheSnapshot(scope, { maxAgeMs });
    },

    saveSnapshot(scope, snapshot) {
      savePageCacheSnapshot(scope, snapshot, { maxAgeMs });
    },

    deleteSnapshot(scope) {
      const map = loadPageCacheScopes({ maxAgeMs });
      delete map[scope];
      savePageCacheScopes(map, { maxAgeMs });
    }
  };
}
