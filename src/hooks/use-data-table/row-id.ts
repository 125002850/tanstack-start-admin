import type { Row, TableOptions } from '@tanstack/react-table';

import type { DataTableRowId } from './types';

/**
 * DataTable 行 ID 解析工具。
 *
 * 稳定 row id 是选择列、展开行和复制/高亮状态的基础；优先使用调用方提供的 getRowId/rowId，
 * 无法解析时回退到 tableId + index，保证表格至少可渲染但仅具备当前页稳定性。
 */
export function stringifyDataTableRowId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  return null;
}

/** index fallback 会带上 parentId，避免子行和同级行 id 冲突。 */
export function getDataTableFallbackRowId({
  tableId,
  index,
  parentId
}: {
  tableId: string;
  index: number;
  parentId?: string | null;
}) {
  return parentId ? `${parentId}-${index}` : `${tableId}-${index}`;
}

/** 按优先级解析行 ID：getRowId -> rowId 函数 -> rowId 字段 -> id 字段 -> fallback。 */
export function resolveDataTableRowId<TData>({
  tableId,
  row,
  index,
  parent,
  parentId,
  rowId,
  getRowId
}: {
  tableId: string;
  row: TData;
  index: number;
  parent?: Row<TData>;
  parentId?: string | null;
  rowId?: DataTableRowId<TData>;
  getRowId?: NonNullable<TableOptions<TData>['getRowId']>;
}) {
  const resolvedParentId = parentId ?? parent?.id ?? null;
  const fallback = getDataTableFallbackRowId({
    tableId,
    index,
    parentId: resolvedParentId
  });

  if (getRowId) {
    return stringifyDataTableRowId(getRowId(row, index, parent)) ?? fallback;
  }

  if (typeof rowId === 'function') {
    return stringifyDataTableRowId(rowId(row, index, parent)) ?? fallback;
  }

  const value = (row as Record<PropertyKey, unknown>)[rowId ?? 'id'];
  return stringifyDataTableRowId(value) ?? fallback;
}
