import {
  type ColumnDef,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import type {
  ColumnFiltersState,
  PaginationState,
  Row,
  SortingState,
  TableOptions
} from '@tanstack/react-table';
import * as React from 'react';

import { dataTableConfig } from '@/config/data-table';
import { getSelectedPageRows } from '@/lib/data-table';
import type { ColumnOrderStorageMode, ColumnResizeStorageMode } from '@/types/data-table';

import { getFixedWidthColumnSizing, omitFixedWidthColumnSizing } from './column-sizing';
import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID,
  DEBOUNCE_MS
} from './constants';
import { findExpandedRow, getStableExpandPanelId } from './expand';
import type { ApiFilters, UseDataTableProps } from './types';
import {
  hasActionsColumn,
  normalizeActionColumn,
  normalizeGeneratedColumnOrder,
  resolveUtilityColumnPinning
} from './columns/layout';
import { createRowActionsColumn } from './columns/row-actions-column';
import { createRowNumberColumn } from './columns/row-number-column';
import { createSelectColumn } from './columns/select-column';
import { useColumnSizingPersistence } from './use-column-sizing-persistence';
import { useTableState } from './use-table-state';

function getPageCount(totalCount: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalCount / pageSize) || 1);
}

function usePaginationForRenderedData<TData>(
  data: TData[],
  pagination: PaginationState
): PaginationState {
  const dataRef = React.useRef(data);
  const paginationRef = React.useRef(pagination);

  if (dataRef.current !== data) {
    dataRef.current = data;
    paginationRef.current = pagination;
  }

  return paginationRef.current;
}

function stringifyResolvedRowId(value: unknown) {
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  return null;
}

function getFallbackRowId<TData>(tableId: string, index: number, parent?: Row<TData>) {
  return parent ? `${parent.id}-${index}` : `${tableId}-${index}`;
}

/**
 * 构建 API 查询参数的工厂函数。自动将 {@link ColumnFiltersState} 映射为后端接受的键值对。
 *
 * @param columnKeyMap - 列 ID 到 API 参数名的映射，例如 `{ name: 'search', role: 'roles' }`。
 *   未在映射中出现的列 ID 原样使用。
 * @returns 一个签名为 `(pagination, sorting, columnFilters) => ApiFilters` 的函数，
 *   可直接传给 {@link UseDataTableProps.apiFiltersBuilder}。
 *
 * @example
 * ```ts
 * useDataTable({
 *   apiFiltersBuilder: makeApiFilters({ name: 'search', category: 'categories' }),
 *   // ...
 * })
 * ```
 */
export function makeApiFilters(columnKeyMap: Record<string, string> = {}) {
  return (
    pagination: PaginationState,
    sorting: SortingState,
    columnFilters: ColumnFiltersState
  ): ApiFilters => {
    const result: ApiFilters = {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize
    };
    for (const f of columnFilters) {
      const v = f.value;
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0))
        continue;
      const key = columnKeyMap[f.id] ?? f.id;
      result[key] = Array.isArray(v) ? v.join(',') : String(v);
    }
    if (sorting.length > 0) {
      result.sort = JSON.stringify(sorting);
    }
    return result;
  };
}

/**
 * 管理 data table 的内部状态，并拼装工具列、展开态、列宽持久化等通用能力。
 */
export function useDataTable<TData>(props: UseDataTableProps<TData>) {
  const {
    columns,
    pageCount: explicitPageCount,
    totalCount,
    initialState,
    debounceMs = DEBOUNCE_MS,
    enableAdvancedFilter = false,
    pageSize: controlledPageSize,
    onPageSizeChange,
    showRowNumberColumn = true,
    rowNumberDisplayMode = 'static',
    showSelectColumn = false,
    tableId,
    rowId,
    getRowId,
    actionColumnPin = 'right',
    rowActions,
    expandConfig,
    onColumnOrderChange: externalOnColumnOrderChange,
    ...tableProps
  } = props;

  const instanceId = React.useId();
  const expandPanelId = expandConfig ? getStableExpandPanelId(tableId, instanceId) : null;
  const [expandedRowKey, setExpandedRowKey] = React.useState<string | null>(null);

  const normalizedColumns = React.useMemo<Array<ColumnDef<TData>>>(
    () => columns.map((column) => normalizeActionColumn(column)),
    [columns]
  );

  const hasGeneratedRowActionsColumn = !!rowActions?.length;

  const baseColumns = React.useMemo<Array<ColumnDef<TData>>>(
    () =>
      normalizedColumns.filter(
        (column) => !hasGeneratedRowActionsColumn || column.id !== DATA_TABLE_ACTIONS_COLUMN_ID
      ),
    [hasGeneratedRowActionsColumn, normalizedColumns]
  );
  const hasManualSelectColumn = React.useMemo(
    () => baseColumns.some((column) => column.id === DATA_TABLE_SELECT_COLUMN_ID),
    [baseColumns]
  );

  const resolvedColumns = React.useMemo<Array<ColumnDef<TData>>>(() => {
    const columnsWithSelection =
      showSelectColumn && !hasManualSelectColumn
        ? [createSelectColumn<TData>(), ...baseColumns]
        : baseColumns;
    const columnsWithActions = hasGeneratedRowActionsColumn
      ? [...columnsWithSelection, createRowActionsColumn(rowActions)]
      : columnsWithSelection;

    // 展开态只通过行点击和背景高亮表达，不再额外插入展开图标列。
    return showRowNumberColumn
      ? [createRowNumberColumn<TData>(totalCount), ...columnsWithActions]
      : columnsWithActions;
  }, [
    baseColumns,
    hasGeneratedRowActionsColumn,
    hasManualSelectColumn,
    rowActions,
    showRowNumberColumn,
    showSelectColumn,
    totalCount
  ]);

  const fixedWidthColumnSizing = React.useMemo(
    () => getFixedWidthColumnSizing(resolvedColumns),
    [resolvedColumns]
  );

  const hasPinnedActionsColumn = React.useMemo(
    () => hasGeneratedRowActionsColumn || hasActionsColumn(baseColumns),
    [baseColumns, hasGeneratedRowActionsColumn]
  );
  const hasSelectColumn = React.useMemo(
    () => showSelectColumn || hasManualSelectColumn,
    [hasManualSelectColumn, showSelectColumn]
  );

  const resolvedInitialState = React.useMemo(() => {
    if (!showRowNumberColumn && !hasPinnedActionsColumn && !hasSelectColumn) {
      return initialState;
    }

    const columnPinning = resolveUtilityColumnPinning(initialState?.columnPinning, {
      hasPinnedActionsColumn,
      actionColumnPin,
      showRowNumberColumn,
      hasSelectColumn
    });

    const columnVisibility = showRowNumberColumn
      ? {
          ...initialState?.columnVisibility,
          [DATA_TABLE_ROW_NUMBER_COLUMN_ID]: true
        }
      : initialState?.columnVisibility;

    return {
      ...initialState,
      columnPinning,
      columnOrder: normalizeGeneratedColumnOrder(initialState?.columnOrder, {
        showRowNumberColumn,
        hasSelectColumn
      }),
      columnVisibility,
      columnSizing: omitFixedWidthColumnSizing(initialState?.columnSizing)
    };
  }, [actionColumnPin, hasPinnedActionsColumn, hasSelectColumn, initialState, showRowNumberColumn]);

  const resolvedStorageMode: ColumnResizeStorageMode = React.useMemo(
    () =>
      (props.columnResizeStorage ?? dataTableConfig.columnResizeStorage) as ColumnResizeStorageMode,
    [props.columnResizeStorage]
  );
  const resolvedColumnOrderStorageMode: ColumnOrderStorageMode = React.useMemo(
    () =>
      (props.columnOrderStorage ?? dataTableConfig.columnOrderStorage) as ColumnOrderStorageMode,
    [props.columnOrderStorage]
  );
  const normalizeColumnOrder = React.useCallback(
    (columnOrder: Array<string> | undefined) =>
      normalizeGeneratedColumnOrder(columnOrder, {
        showRowNumberColumn,
        hasSelectColumn
      }),
    [hasSelectColumn, showRowNumberColumn]
  );

  const {
    rowSelection,
    setRowSelection,
    columnVisibility,
    setColumnVisibility,
    columnPinning,
    setColumnPinning,
    columnOrder,
    onColumnOrderChange,
    resetColumnOrder,
    hasCustomColumnOrder,
    columnSizing,
    setColumnSizing,
    onColumnSizingChange,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    columnFilters,
    onColumnFiltersChange
  } = useTableState<TData>({
    resolvedInitialState,
    controlledPageSize,
    onPageSizeChange,
    enableAdvancedFilter,
    tableId,
    rowSelectionScopeKey: props.rowSelectionScopeKey,
    resolvedStorageMode,
    resolvedColumnOrderStorageMode,
    normalizeColumnOrder,
    externalOnColumnOrderChange,
    fixedWidthColumnSizing
  });

  const rowNumberPagination = usePaginationForRenderedData(tableProps.data, pagination);

  const resolvedPageCount = React.useMemo(() => {
    if (typeof explicitPageCount === 'number') {
      return explicitPageCount;
    }

    if (typeof totalCount === 'number') {
      return getPageCount(totalCount, pagination.pageSize);
    }

    return -1;
  }, [explicitPageCount, pagination.pageSize, totalCount]);

  const resolvedGetRowId = React.useCallback<NonNullable<TableOptions<TData>['getRowId']>>(
    (row, index, parent) => {
      if (getRowId) {
        return getRowId(row, index, parent);
      }

      if (typeof rowId === 'function') {
        return String(rowId(row, index, parent));
      }

      const value = (row as Record<PropertyKey, unknown>)[rowId ?? 'id'];

      return stringifyResolvedRowId(value) ?? getFallbackRowId(tableId, index, parent);
    },
    [getRowId, rowId, tableId]
  );

  const table = useReactTable({
    ...tableProps,
    columns: resolvedColumns,
    initialState: resolvedInitialState,
    pageCount: resolvedPageCount,
    meta: {
      ...tableProps.meta,
      rowNumberDisplayMode,
      rowNumberPagination,
      dataTableColumnOrder: {
        hasCustomOrder: hasCustomColumnOrder,
        reset: resetColumnOrder
      }
    },
    state: {
      pagination,
      sorting,
      columnVisibility,
      columnPinning,
      columnOrder,
      rowSelection,
      columnFilters,
      columnSizing
    },
    defaultColumn: {
      minSize: 80,
      size: 150,
      ...tableProps.defaultColumn,
      enableColumnFilter: false
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnSizingChange,
    onColumnOrderChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    getRowId: resolvedGetRowId,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd' as const,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true
  });

  const expandedRow =
    !expandConfig || !expandedRowKey
      ? null
      : findExpandedRow({
          rows: table.getRowModel().rows,
          expandedRowKey,
          rowKey: expandConfig.rowKey
        });

  React.useEffect(() => {
    if (expandedRowKey && !expandedRow) {
      setExpandedRowKey(null);
    }
  }, [expandedRow, expandedRowKey]);

  const { resetColumnSizing } = useColumnSizingPersistence({
    table,
    tableId,
    resolvedStorageMode,
    onColumnResizeEnd: props.onColumnResizeEnd,
    resolvedInitialColumnSizing: resolvedInitialState?.columnSizing,
    setColumnSizing
  });

  const getSelectedRows = React.useCallback(() => getSelectedPageRows(table), [table]);
  const selectedRows = getSelectedRows();
  const clearSelectedRows = React.useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);

  return {
    table,
    selectedRows,
    getSelectedRows,
    clearSelectedRows,
    debounceMs,
    throttleMs: tableProps.throttleMs,
    resetColumnSizing,
    expandConfig,
    expandedRowKey,
    setExpandedRowKey,
    expandedRow,
    expandPanelId
  };
}
