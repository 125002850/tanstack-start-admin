import type { Row, TableOptions } from '@tanstack/react-table';

import type { DataTableRowId } from './types';

export function stringifyDataTableRowId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  return null;
}

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
