import type { ColumnOrderState, ColumnSizingState, SortingState } from '@tanstack/react-table';

/**
 * DataTable 本地状态持久化。
 *
 * 当前统一管理每页条数、列宽、列顺序和排序。所有读取都会做版本检查和 sanitize，
 * storage 不可用或数据损坏时静默回退，避免本地缓存影响表格可用性。
 */
export type DataTableStateStorageMode = 'localStorage' | 'sessionStorage' | false;

/** 缓存结构版本；后续格式变化时提升版本即可让旧缓存自然失效。 */
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
  // Safari 隐私模式、SSR 或禁用 storage 时访问可能抛错，所以必须 try/catch。
  if (mode === false) return null;

  try {
    return mode === 'sessionStorage' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return null;
  }
}

/** 表格维度的状态切片 key，避免不同 tableId 之间互相污染。 */
function getDataTableStateStorageKey(tableId: string, slice: DataTableStateSlice): string {
  return `${DATA_TABLE_STORAGE_PREFIX}:${tableId}:${slice}`;
}

/** pageSize 保留全局默认 key，同时支持 tableId 维度覆盖。 */
function getDataTablePageSizeStorageKey(tableId?: string): string {
  if (!tableId) return DATA_TABLE_PAGE_SIZE_STORAGE_KEY;
  return `${DATA_TABLE_PAGE_SIZE_STORAGE_KEY}:${tableId}`;
}

/** 读取 JSON 缓存并确保顶层是普通对象，损坏数据直接丢弃。 */
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

/** 写入 JSON 缓存；容量满或 storage 不可用时静默降级。 */
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
    // storage 容量满或不可用时静默降级。
  }
}

/** 删除指定状态切片缓存；删除失败不影响表格主流程。 */
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
    // storage 不可用时静默降级。
  }
}

/** 清洗列宽缓存：只保留正的有限数字。 */
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

/** 清洗列顺序缓存：只保留非空字符串，并去重保持首次出现顺序。 */
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

/** 清洗排序缓存：只保留 `{ id: string, desc: boolean }` 且 id 去重。 */
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

/** pageSize 必须来自白名单，避免非法缓存导致分页异常。 */
export function isValidDataTablePageSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    DATA_TABLE_PAGE_SIZE_OPTION_SET.has(value)
  );
}

/** 将任意输入归一化为允许的 pageSize。 */
export function normalizeDataTablePageSize(
  value: unknown,
  fallback = DEFAULT_DATA_TABLE_PAGE_SIZE
): number {
  return isValidDataTablePageSize(value) ? value : fallback;
}

/** 读取 pageSize 偏好；无缓存、非法缓存或 storage 不可用时返回 null。 */
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

/** 写入 pageSize 前再次 normalize，保证 storage 内始终是白名单值。 */
export function writeDataTablePageSize(pageSize: number, tableId?: string): void {
  const storage = getStorage('localStorage');
  if (!storage) return;

  try {
    storage.setItem(
      getDataTablePageSizeStorageKey(tableId),
      String(normalizeDataTablePageSize(pageSize))
    );
  } catch {
    // storage 不可用时静默降级。
  }
}

/** 读取列宽缓存；版本不匹配时视为无缓存。 */
export function loadDataTableColumnSizing(
  tableId: string,
  mode: DataTableStateStorageMode
): ColumnSizingState {
  const cache = readJsonCache(tableId, 'column-sizing', mode);
  if (!cache || cache.version !== CACHE_VERSION) return {};

  return sanitizeColumnSizing(cache.sizing);
}

/** 保存列宽缓存，写入前清洗掉非法宽度。 */
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

/** 清除列宽缓存。 */
export function clearDataTableColumnSizing(tableId: string, mode: DataTableStateStorageMode): void {
  clearJsonCache(tableId, 'column-sizing', mode);
}

/** 比较列顺序是否完全一致。 */
export function areDataTableColumnOrdersEqual(
  left: ColumnOrderState | undefined,
  right: ColumnOrderState | undefined
): boolean {
  const a = left ?? [];
  const b = right ?? [];

  if (a.length !== b.length) return false;

  return a.every((columnId, index) => columnId === b[index]);
}

/** 在列顺序数组中移动 activeId 到 overId 所在位置。 */
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

/** 读取列顺序缓存；版本不匹配时返回空数组。 */
export function loadDataTableColumnOrder(
  tableId: string,
  mode: DataTableStateStorageMode
): ColumnOrderState {
  const cache = readJsonCache(tableId, 'column-order', mode);
  if (!cache || cache.version !== CACHE_VERSION) return [];

  return sanitizeColumnOrder(cache.order);
}

/** 保存列顺序缓存，写入前清洗空值和重复值。 */
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

/** 清除列顺序缓存。 */
export function clearDataTableColumnOrder(tableId: string, mode: DataTableStateStorageMode): void {
  clearJsonCache(tableId, 'column-order', mode);
}

/** 读取排序缓存；返回 null 表示没有可用缓存，调用方可回退 initialState。 */
export function readDataTableSorting(
  tableId: string,
  mode: DataTableStateStorageMode
): SortingState | null {
  const cache = readJsonCache(tableId, 'sorting', mode);
  if (!cache || cache.version !== CACHE_VERSION) return null;

  return sanitizeSorting(cache.sorting);
}

/** 读取排序缓存；无缓存时返回空数组。 */
export function loadDataTableSorting(
  tableId: string,
  mode: DataTableStateStorageMode
): SortingState {
  return readDataTableSorting(tableId, mode) ?? [];
}

/** 保存排序缓存，写入前清洗非法项和重复列。 */
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

/** 清除排序缓存。 */
export function clearDataTableSorting(tableId: string, mode: DataTableStateStorageMode): void {
  clearJsonCache(tableId, 'sorting', mode);
}

/** 比较排序状态是否完全一致。 */
export function areDataTableSortingStatesEqual(
  left: SortingState | undefined,
  right: SortingState | undefined
): boolean {
  const a = left ?? [];
  const b = right ?? [];

  if (a.length !== b.length) return false;

  return a.every((sort, index) => sort.id === b[index]?.id && sort.desc === b[index]?.desc);
}
