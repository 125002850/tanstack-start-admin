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
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';
import * as React from 'react';

import { dataTableConfig } from '@/config/data-table';
import type { ColumnResizeStorageMode } from '@/types/data-table';

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
    pageCount = -1,
    initialState,
    debounceMs = DEBOUNCE_MS,
    enableAdvancedFilter = false,
    pageSize: controlledPageSize,
    onPageSizeChange,
    showRowNumberColumn = true,
    showSelectColumn = false,
    actionColumnPin = 'right',
    rowActions,
    expandConfig,
    ...tableProps
  } = props;

  const instanceId = React.useId();
  const expandPanelId = expandConfig ? getStableExpandPanelId(props.tableId, instanceId) : null;
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

  const resolvedColumns = React.useMemo<Array<ColumnDef<TData>>>(
    () => {
      const columnsWithSelection =
        showSelectColumn && !hasManualSelectColumn
          ? [createSelectColumn<TData>(), ...baseColumns]
          : baseColumns;
      const columnsWithActions = hasGeneratedRowActionsColumn
        ? [...columnsWithSelection, createRowActionsColumn(rowActions)]
        : columnsWithSelection;

      // 展开态只通过行点击和背景高亮表达，不再额外插入展开图标列。
      return showRowNumberColumn
        ? [createRowNumberColumn<TData>(), ...columnsWithActions]
        : columnsWithActions;
    },
    [
      baseColumns,
      hasGeneratedRowActionsColumn,
      hasManualSelectColumn,
      rowActions,
      showRowNumberColumn,
      showSelectColumn
    ]
  );

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
    if (
      !showRowNumberColumn &&
      !hasPinnedActionsColumn &&
      !hasSelectColumn
    ) {
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
  }, [
    actionColumnPin,
    hasPinnedActionsColumn,
    hasSelectColumn,
    initialState,
    showRowNumberColumn
  ]);

  const resolvedStorageMode: ColumnResizeStorageMode = React.useMemo(
    () =>
      (props.columnResizeStorage ?? dataTableConfig.columnResizeStorage) as ColumnResizeStorageMode,
    [props.columnResizeStorage]
  );

  const {
    rowSelection,
    setRowSelection,
    columnVisibility,
    setColumnVisibility,
    columnPinning,
    setColumnPinning,
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
    tableId: props.tableId,
    rowSelectionScopeKey: props.rowSelectionScopeKey,
    resolvedStorageMode,
    fixedWidthColumnSizing
  });

  const table = useReactTable({
    ...tableProps,
    columns: resolvedColumns,
    initialState: resolvedInitialState,
    pageCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      columnPinning,
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
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
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
    tableId: props.tableId,
    resolvedStorageMode,
    onColumnResizeEnd: props.onColumnResizeEnd,
    resolvedInitialColumnSizing: resolvedInitialState?.columnSizing,
    setColumnSizing
  });

  const getSelectedRows = React.useCallback(
    () => table.getFilteredSelectedRowModel().rows.map((row) => row.original),
    [table]
  );
  const clearSelectedRows = React.useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);

  return {
    table,
    selectedRows: getSelectedRows(),
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
