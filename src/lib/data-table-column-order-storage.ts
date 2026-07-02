export type ColumnOrderStorageMode = 'localStorage' | 'sessionStorage' | false;

const CACHE_VERSION = 1;

interface ColumnOrderCache {
  version: number;
  order: string[];
}

function storageKey(tableId: string): string {
  return `data-table:${tableId}:column-order`;
}

function resolveStorage(mode: 'localStorage' | 'sessionStorage'): Storage {
  return mode === 'sessionStorage' ? sessionStorage : localStorage;
}

function sanitizeColumnOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const order: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;

    const columnId = item.trim();
    if (!columnId || seen.has(columnId)) continue;

    seen.add(columnId);
    order.push(columnId);
  }

  return order;
}

export function areColumnOrdersEqual(left: string[] | undefined, right: string[] | undefined) {
  const a = left ?? [];
  const b = right ?? [];

  if (a.length !== b.length) return false;

  return a.every((columnId, index) => columnId === b[index]);
}

export function moveColumnOrder(columnOrder: string[], activeId: string, overId: string): string[] {
  if (activeId === overId) return columnOrder;

  const oldIndex = columnOrder.indexOf(activeId);
  const newIndex = columnOrder.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1) return columnOrder;

  const nextOrder = [...columnOrder];
  const [moved] = nextOrder.splice(oldIndex, 1);
  nextOrder.splice(newIndex, 0, moved);

  return nextOrder;
}

export function loadColumnOrder(tableId: string, mode: ColumnOrderStorageMode): string[] {
  if (mode === false) return [];

  try {
    const raw = resolveStorage(mode).getItem(storageKey(tableId));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];

    const cache = parsed as ColumnOrderCache;
    if (cache.version !== CACHE_VERSION) return [];

    return sanitizeColumnOrder(cache.order);
  } catch {
    return [];
  }
}

export function saveColumnOrder(
  tableId: string,
  order: string[],
  mode: ColumnOrderStorageMode
): void {
  if (mode === false) return;

  try {
    const cache: ColumnOrderCache = { version: CACHE_VERSION, order: sanitizeColumnOrder(order) };
    resolveStorage(mode).setItem(storageKey(tableId), JSON.stringify(cache));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function clearColumnOrder(tableId: string, mode: ColumnOrderStorageMode): void {
  if (mode === false) return;

  try {
    resolveStorage(mode).removeItem(storageKey(tableId));
  } catch {
    // silently ignore
  }
}
