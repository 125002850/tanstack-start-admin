import type { ColumnOrderState, ColumnSizingState, SortingState } from '@tanstack/react-table';

export type DataTableStateStorageMode = 'localStorage' | 'sessionStorage' | false;

const CACHE_VERSION = 1;
const DATA_TABLE_STORAGE_PREFIX = 'data-table';
const DATA_TABLE_PAGE_SIZE_STORAGE_KEY = 'app-data-table-per-page';

const DATA_TABLE_PAGE_SIZE_TINY = 10;
const DATA_TABLE_PAGE_SIZE_SMALL = 50;
const DATA_TABLE_PAGE_SIZE_MEDIUM = 200;
const DATA_TABLE_PAGE_SIZE_LARGE = 500;
const DATA_TABLE_PAGE_SIZE_EXTRA_LARGE = 2000;

export const DATA_TABLE_PAGE_SIZE_OPTIONS = [
  DATA_TABLE_PAGE_SIZE_TINY,
  DATA_TABLE_PAGE_SIZE_SMALL,
  DATA_TABLE_PAGE_SIZE_MEDIUM,
  DATA_TABLE_PAGE_SIZE_LARGE,
  DATA_TABLE_PAGE_SIZE_EXTRA_LARGE
] as const;
export const DEFAULT_DATA_TABLE_PAGE_SIZE = DATA_TABLE_PAGE_SIZE_SMALL;

type DataTableStateSlice = 'column-sizing' | 'column-order' | 'sorting';

interface ColumnSizingCache {
  version: number;
  sizing: ColumnSizingState;
}

interface ColumnOrderCache {
  version: number;
  order: ColumnOrderState;
}

interface SortingCache {
  version: number;
  sorting: SortingState;
}

const DATA_TABLE_PAGE_SIZE_OPTION_SET = new Set<number>(DATA_TABLE_PAGE_SIZE_OPTIONS);

function getStorage(mode: DataTableStateStorageMode): Storage | null {
  if (mode === false) return null;

  try {
    return mode === 'sessionStorage' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return null;
  }
}

function getDataTableStateStorageKey(tableId: string, slice: DataTableStateSlice): string {
  return `${DATA_TABLE_STORAGE_PREFIX}:${tableId}:${slice}`;
}

function getDataTablePageSizeStorageKey(tableId?: string): string {
  if (!tableId) return DATA_TABLE_PAGE_SIZE_STORAGE_KEY;
  return `${DATA_TABLE_PAGE_SIZE_STORAGE_KEY}:${tableId}`;
}

function readJsonCache(
  tableId: string,
  slice: DataTableStateSlice,
  mode: DataTableStateStorageMode
): Record<string, unknown> | null {
  const storage = getStorage(mode);
  if (!storage) return null;

  try {
    const raw = storage.getItem(getDataTableStateStorageKey(tableId, slice));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJsonCache(
  tableId: string,
  slice: DataTableStateSlice,
  value: unknown,
  mode: DataTableStateStorageMode
): void {
  const storage = getStorage(mode);
  if (!storage) return;

  try {
    storage.setItem(getDataTableStateStorageKey(tableId, slice), JSON.stringify(value));
  } catch {
    // storage full or unavailable - degrade silently
  }
}

function clearJsonCache(
  tableId: string,
  slice: DataTableStateSlice,
  mode: DataTableStateStorageMode
): void {
  const storage = getStorage(mode);
  if (!storage) return;

  try {
    storage.removeItem(getDataTableStateStorageKey(tableId, slice));
  } catch {
    // storage unavailable - degrade silently
  }
}

function sanitizeColumnSizing(value: unknown): ColumnSizingState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const result: ColumnSizingState = {};

  for (const [key, width] of Object.entries(value)) {
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      result[key] = width;
    }
  }

  return result;
}

function sanitizeColumnOrder(value: unknown): ColumnOrderState {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const order: ColumnOrderState = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;

    const columnId = item.trim();
    if (!columnId || seen.has(columnId)) continue;

    seen.add(columnId);
    order.push(columnId);
  }

  return order;
}

function sanitizeSorting(value: unknown): SortingState {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const sorting: SortingState = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.desc !== 'boolean') continue;

    const columnId = candidate.id.trim();
    if (!columnId || seen.has(columnId)) continue;

    seen.add(columnId);
    sorting.push({ id: columnId, desc: candidate.desc });
  }

  return sorting;
}

export function isValidDataTablePageSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    DATA_TABLE_PAGE_SIZE_OPTION_SET.has(value)
  );
}

export function normalizeDataTablePageSize(
  value: unknown,
  fallback = DEFAULT_DATA_TABLE_PAGE_SIZE
): number {
  return isValidDataTablePageSize(value) ? value : fallback;
}

export function readDataTablePageSize(tableId?: string): number | null {
  const storage = getStorage('localStorage');
  if (!storage) return null;

  try {
    const raw = storage.getItem(getDataTablePageSizeStorageKey(tableId));
    if (!raw) return null;

    const parsed = Number.parseInt(raw, 10);
    return isValidDataTablePageSize(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDataTablePageSize(pageSize: number, tableId?: string): void {
  const storage = getStorage('localStorage');
  if (!storage) return;

  try {
    storage.setItem(
      getDataTablePageSizeStorageKey(tableId),
      String(normalizeDataTablePageSize(pageSize))
    );
  } catch {
    // storage unavailable - degrade silently
  }
}

export function loadDataTableColumnSizing(
  tableId: string,
  mode: DataTableStateStorageMode
): ColumnSizingState {
  const cache = readJsonCache(tableId, 'column-sizing', mode);
  if (!cache || cache.version !== CACHE_VERSION) return {};

  return sanitizeColumnSizing(cache.sizing);
}

export function saveDataTableColumnSizing(
  tableId: string,
  sizing: ColumnSizingState,
  mode: DataTableStateStorageMode
): void {
  writeJsonCache(
    tableId,
    'column-sizing',
    { version: CACHE_VERSION, sizing: sanitizeColumnSizing(sizing) } satisfies ColumnSizingCache,
    mode
  );
}

export function clearDataTableColumnSizing(tableId: string, mode: DataTableStateStorageMode): void {
  clearJsonCache(tableId, 'column-sizing', mode);
}

export function areDataTableColumnOrdersEqual(
  left: ColumnOrderState | undefined,
  right: ColumnOrderState | undefined
): boolean {
  const a = left ?? [];
  const b = right ?? [];

  if (a.length !== b.length) return false;

  return a.every((columnId, index) => columnId === b[index]);
}

export function moveDataTableColumnOrder(
  columnOrder: ColumnOrderState,
  activeId: string,
  overId: string
): ColumnOrderState {
  if (activeId === overId) return columnOrder;

  const oldIndex = columnOrder.indexOf(activeId);
  const newIndex = columnOrder.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1) return columnOrder;

  const nextOrder = [...columnOrder];
  const [moved] = nextOrder.splice(oldIndex, 1);
  nextOrder.splice(newIndex, 0, moved);

  return nextOrder;
}

export function loadDataTableColumnOrder(
  tableId: string,
  mode: DataTableStateStorageMode
): ColumnOrderState {
  const cache = readJsonCache(tableId, 'column-order', mode);
  if (!cache || cache.version !== CACHE_VERSION) return [];

  return sanitizeColumnOrder(cache.order);
}

export function saveDataTableColumnOrder(
  tableId: string,
  order: ColumnOrderState,
  mode: DataTableStateStorageMode
): void {
  writeJsonCache(
    tableId,
    'column-order',
    { version: CACHE_VERSION, order: sanitizeColumnOrder(order) } satisfies ColumnOrderCache,
    mode
  );
}

export function clearDataTableColumnOrder(tableId: string, mode: DataTableStateStorageMode): void {
  clearJsonCache(tableId, 'column-order', mode);
}

export function readDataTableSorting(
  tableId: string,
  mode: DataTableStateStorageMode
): SortingState | null {
  const cache = readJsonCache(tableId, 'sorting', mode);
  if (!cache || cache.version !== CACHE_VERSION) return null;

  return sanitizeSorting(cache.sorting);
}

export function loadDataTableSorting(
  tableId: string,
  mode: DataTableStateStorageMode
): SortingState {
  return readDataTableSorting(tableId, mode) ?? [];
}

export function saveDataTableSorting(
  tableId: string,
  sorting: SortingState,
  mode: DataTableStateStorageMode
): void {
  writeJsonCache(
    tableId,
    'sorting',
    { version: CACHE_VERSION, sorting: sanitizeSorting(sorting) } satisfies SortingCache,
    mode
  );
}

export function clearDataTableSorting(tableId: string, mode: DataTableStateStorageMode): void {
  clearJsonCache(tableId, 'sorting', mode);
}

export function areDataTableSortingStatesEqual(
  left: SortingState | undefined,
  right: SortingState | undefined
): boolean {
  const a = left ?? [];
  const b = right ?? [];

  if (a.length !== b.length) return false;

  return a.every((sort, index) => sort.id === b[index]?.id && sort.desc === b[index]?.desc);
}
