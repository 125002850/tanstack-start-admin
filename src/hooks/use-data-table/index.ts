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
import type { UseDataTableProps } from './types';
import {
  hasActionsColumn,
  normalizeActionColumn,
  normalizeGeneratedColumnOrder,
  resolveUtilityColumnPinning
} from './columns/layout';
import { createRowActionsColumn } from './columns/row-actions-column';
import { createRowNumberColumn } from './columns/row-number-column';
import { useColumnSizingPersistence } from './use-column-sizing-persistence';
import { useTableState } from './use-table-state';

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

  const resolvedColumns = React.useMemo<Array<ColumnDef<TData>>>(
    () => {
      const columnsWithActions = hasGeneratedRowActionsColumn
        ? [...baseColumns, createRowActionsColumn(rowActions)]
        : baseColumns;

      // 展开态只通过行点击和背景高亮表达，不再额外插入展开图标列。
      return showRowNumberColumn
        ? [createRowNumberColumn<TData>(), ...columnsWithActions]
        : columnsWithActions;
    },
    [baseColumns, hasGeneratedRowActionsColumn, rowActions, showRowNumberColumn]
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
    () => baseColumns.some((column) => column.id === DATA_TABLE_SELECT_COLUMN_ID),
    [baseColumns]
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

  return {
    table,
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
