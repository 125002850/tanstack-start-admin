export type ColumnResizeStorageMode = 'localStorage' | 'sessionStorage' | false;

function storageKey(tableId: string): string {
  return `data-table:${tableId}:column-sizing`;
}

const CACHE_VERSION = 1;

interface ColumnSizingCache {
  version: number;
  sizing: Record<string, number>;
}

function resolveStorage(mode: 'localStorage' | 'sessionStorage'): Storage {
  return mode === 'sessionStorage' ? sessionStorage : localStorage;
}

export function loadColumnSizing(
  tableId: string,
  mode: ColumnResizeStorageMode
): Record<string, number> {
  if (mode === false) return {};
  try {
    const raw = resolveStorage(mode).getItem(storageKey(tableId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const cache = parsed as ColumnSizingCache;
    if (cache.version !== CACHE_VERSION) return {};
    if (typeof cache.sizing !== 'object' || cache.sizing === null) return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(cache.sizing)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveColumnSizing(
  tableId: string,
  sizing: Record<string, number>,
  mode: ColumnResizeStorageMode
): void {
  if (mode === false) return;
  try {
    const cache: ColumnSizingCache = { version: CACHE_VERSION, sizing };
    resolveStorage(mode).setItem(storageKey(tableId), JSON.stringify(cache));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function clearColumnSizing(tableId: string, mode: ColumnResizeStorageMode): void {
  if (mode === false) return;
  try {
    resolveStorage(mode).removeItem(storageKey(tableId));
  } catch {
    // silently ignore
  }
}
