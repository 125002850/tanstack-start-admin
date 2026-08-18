import {
  type ColumnDef,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import type { PaginationState, TableOptions } from '@tanstack/react-table';
import * as React from 'react';

import { dataTableColumnSizes, dataTableConfig } from '@/config/data-table';
import { getSelectedPageRows } from '@/lib/data-table/selection';
import type {
  ColumnOrderStorageMode,
  ColumnResizeStorageMode,
  DataTableEditableColumnMeta,
  SortingStorageMode
} from '@/types/data-table';

import { getFixedWidthColumnSizing, omitFixedWidthColumnSizing } from './column-sizing';
import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID
} from './constants';
import { findExpandedRow, getStableExpandPanelId } from './expand';
import type { DataTableRuntimeConfiguredTableOption, UseDataTableProps } from './types';
import {
  hasActionsColumn,
  normalizeActionColumn,
  normalizeGeneratedColumnOrder,
  resolveUtilityColumnPinning
} from './columns/layout';
import { createRowActionsColumn } from './columns/row-actions-column';
import { createRowNumberColumn } from './columns/row-number-column';
import { createSelectColumn } from './columns/select-column';
import { resolveDataTableRowId, stringifyDataTableRowId } from './row-id';
import { useColumnSizingPersistence } from './use-column-sizing-persistence';
import { useDataTableEditing } from './use-data-table-editing';
import { useTableState } from './use-table-state';
import { useDataTableLocalFiltering } from './use-data-table-local-filtering';

/**
 * DataTable 核心状态装配 hook。
 *
 * 它在 TanStack useReactTable 外包一层项目约定：
 * 工具列注入、行号/选择/操作列固定规则、列宽/列顺序/排序持久化、排序执行模式、
 * 分页状态、行展开状态和选中行便捷 API。
 */
function getPageCount(totalCount: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalCount / pageSize) || 1);
}

/** 行号列需要在数据引用变化前保留旧 pagination，用于渲染中的当前页编号稳定。 */
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

const warnedSelectionFallbackTableIds = new Set<string>();
const warnedEditingFallbackTableIds = new Set<string>();

function collectEditableFields<TData>(columns: readonly ColumnDef<TData>[]) {
  const fields = new Map<Extract<keyof TData, string>, DataTableEditableColumnMeta<TData>>();
  const visit = (column: ColumnDef<TData>) => {
    const editableCell = column.meta?.editableCell ?? column.meta?.editableChoice;
    if (editableCell) {
      fields.set(editableCell.field, editableCell);
    }
    if ('columns' in column && Array.isArray(column.columns)) {
      column.columns.forEach(visit);
    }
  };
  columns.forEach(visit);
  return fields;
}

/**
 * 管理 data table 的内部状态，并拼装工具列、展开态、列宽持久化等通用能力。
 */
export function useDataTable<TData>(props: UseDataTableProps<TData>) {
  return useDataTableRuntime(props);
}

interface DataTableRuntimeContext {
  editingScope?: {
    pageNo: number;
    scopeKey: string;
    requireExplicitRowId: boolean;
  };
  enableZebraStriping?: boolean;
}

/** 仅供共享 hook 组合使用；业务代码必须通过公开的 useDataTable/useDslDataTable 接入。 */
export function useDataTableRuntime<TData>(
  props: UseDataTableProps<TData>,
  runtimeContext: DataTableRuntimeContext = {}
) {
  const {
    columns,
    pageCount: explicitPageCount,
    totalCount,
    initialState,
    pageSize: controlledPageSize,
    onPageSizeChange,
    showRowNumberColumn = true,
    rowNumberDisplayMode = 'static',
    showSelectColumn = false,
    tableId,
    rowId,
    actionColumnPin = 'right',
    rowActions,
    expandConfig,
    editing: editingOptions,
    sortingMode = 'client',
    onColumnOrderChange: externalOnColumnOrderChange,
    ...tableProps
  } = props;
  const editingPageNo = runtimeContext.editingScope?.pageNo;
  const editingScopeKey = runtimeContext.editingScope?.scopeKey ?? 'default';
  const requireExplicitEditingRowId = runtimeContext.editingScope?.requireExplicitRowId ?? false;

  const instanceId = React.useId();
  // 展开面板 id 优先来自 tableId；无 tableId 时用 React id 兜底并移除冒号。
  const expandPanelId = expandConfig ? getStableExpandPanelId(tableId, instanceId) : null;
  const [expandedRowKey, setExpandedRowKey] = React.useState<string | null>(null);

  const normalizedColumns = React.useMemo<Array<ColumnDef<TData>>>(
    // 手写 actions 列也会被规范化为不可 resize，保持和自动生成操作列一致。
    () => columns.map((column) => normalizeActionColumn(column)),
    [columns]
  );

  const hasGeneratedRowActionsColumn = !!rowActions?.length;

  const baseColumns = React.useMemo<Array<ColumnDef<TData>>>(
    // 如果传入 rowActions，就移除业务方同名 actions 列，避免重复操作列。
    () =>
      normalizedColumns.filter(
        (column) => !hasGeneratedRowActionsColumn || column.id !== DATA_TABLE_ACTIONS_COLUMN_ID
      ),
    [hasGeneratedRowActionsColumn, normalizedColumns]
  );
  const hasManualSelectColumn = React.useMemo(
    // 业务方手写 select 列时，不再自动注入选择列。
    () => baseColumns.some((column) => column.id === DATA_TABLE_SELECT_COLUMN_ID),
    [baseColumns]
  );
  const rowNumberCount = totalCount ?? tableProps.data.length;

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
      ? [createRowNumberColumn<TData>(rowNumberCount), ...columnsWithActions]
      : columnsWithActions;
  }, [
    baseColumns,
    hasGeneratedRowActionsColumn,
    hasManualSelectColumn,
    rowActions,
    rowNumberCount,
    showRowNumberColumn,
    showSelectColumn
  ]);

  const fixedWidthColumnSizing = React.useMemo(
    // 固定宽度工具列的 sizing 不写入持久化，避免用户缓存覆盖固定尺寸。
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
      // 工具列 pinning 优先于业务初始 pinning，确保序号/选择/操作列位置稳定。
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
        // 生成列必须排在业务列前面，持久化顺序恢复时也要重新规整。
        showRowNumberColumn,
        hasSelectColumn
      }),
      columnVisibility,
      columnSizing: omitFixedWidthColumnSizing(initialState?.columnSizing)
    };
  }, [actionColumnPin, hasPinnedActionsColumn, hasSelectColumn, initialState, showRowNumberColumn]);

  const resolvedStorageMode: ColumnResizeStorageMode = React.useMemo(
    // 单表可覆盖存储模式，未传时使用全局 DataTable 配置。
    () =>
      (props.columnResizeStorage ?? dataTableConfig.columnResizeStorage) as ColumnResizeStorageMode,
    [props.columnResizeStorage]
  );
  const resolvedColumnOrderStorageMode: ColumnOrderStorageMode = React.useMemo(
    () =>
      (props.columnOrderStorage ?? dataTableConfig.columnOrderStorage) as ColumnOrderStorageMode,
    [props.columnOrderStorage]
  );
  const resolvedSortingStorageMode: SortingStorageMode = React.useMemo(
    () => (props.sortingStorage ?? dataTableConfig.sortingStorage) as SortingStorageMode,
    [props.sortingStorage]
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
    tableId,
    rowSelectionScopeKey: props.rowSelectionScopeKey,
    resolvedStorageMode,
    resolvedColumnOrderStorageMode,
    resolvedSortingStorageMode,
    normalizeColumnOrder,
    externalOnColumnOrderChange,
    fixedWidthColumnSizing
  });

  const rowNumberPagination = usePaginationForRenderedData(tableProps.data, pagination);

  React.useEffect(() => {
    // 选择列启用但没有稳定 row id 时，只能做当前页范围选择，开发环境给出提示。
    if (!import.meta.env.DEV || !showSelectColumn || rowId !== undefined) {
      return;
    }

    const usesIndexFallback = tableProps.data.some((row) => {
      const value = (row as Record<PropertyKey, unknown>).id;
      return stringifyDataTableRowId(value) === null;
    });

    if (!usesIndexFallback || warnedSelectionFallbackTableIds.has(tableId)) {
      return;
    }

    warnedSelectionFallbackTableIds.add(tableId);
    console.warn(
      '[useDataTable] Select column is using page-scoped selection with index fallback row ids.',
      {
        tableId,
        rowIdSource: 'index-fallback',
        selectionScope: 'page'
      }
    );
  }, [rowId, showSelectColumn, tableId, tableProps.data]);

  const resolvedPageCount = React.useMemo(() => {
    if (typeof explicitPageCount === 'number') {
      return explicitPageCount;
    }

    if (typeof totalCount === 'number') {
      // 服务端分页常见场景：只传 totalCount，由 hook 按当前 pageSize 推导页数。
      return getPageCount(totalCount, pagination.pageSize);
    }

    return -1;
  }, [explicitPageCount, pagination.pageSize, totalCount]);

  const resolvedGetRowId = React.useCallback<NonNullable<TableOptions<TData>['getRowId']>>(
    (row, index, parent) =>
      resolveDataTableRowId({
        tableId,
        row,
        index,
        parent,
        rowId
      }),
    [rowId, tableId]
  );
  const editableFields = React.useMemo(() => collectEditableFields(baseColumns), [baseColumns]);
  const hasExplicitEditingRowId = rowId !== undefined;
  const editingEnabled =
    editableFields.size > 0 && (!requireExplicitEditingRowId || hasExplicitEditingRowId);
  const resolvedEditableFields = React.useMemo(
    () =>
      editingEnabled
        ? editableFields
        : new Map<Extract<keyof TData, string>, DataTableEditableColumnMeta<TData>>(),
    [editableFields, editingEnabled]
  );
  const editingState = useDataTableEditing({
    tableId,
    editableFields: resolvedEditableFields,
    getRowId: (row, index) => resolvedGetRowId(row, index),
    options: editingOptions
  });
  const loadEditingScopePage = editingState.loadScopePage;
  const resolvedEditingPageNo = editingPageNo ?? pagination.pageIndex + 1;

  React.useLayoutEffect(() => {
    if (!editingEnabled) return;
    loadEditingScopePage(editingScopeKey, resolvedEditingPageNo, tableProps.data);
  }, [
    editingEnabled,
    editingScopeKey,
    loadEditingScopePage,
    resolvedEditingPageNo,
    tableProps.data
  ]);

  React.useEffect(() => {
    if (
      !import.meta.env.DEV ||
      editableFields.size === 0 ||
      !requireExplicitEditingRowId ||
      hasExplicitEditingRowId ||
      warnedEditingFallbackTableIds.has(tableId)
    ) {
      return;
    }
    warnedEditingFallbackTableIds.add(tableId);
    console.warn('[useDataTable] Cross-page editing requires an explicit stable rowId.', {
      tableId,
      editing: 'disabled',
      rowIdSource: 'index-fallback'
    });
  }, [editableFields.size, hasExplicitEditingRowId, requireExplicitEditingRowId, tableId]);

  const editingRows =
    editingEnabled &&
    editingState.scopeKey === editingScopeKey &&
    editingState.hasLoadedPage(resolvedEditingPageNo)
      ? editingState.getRowsForPage(resolvedEditingPageNo)
      : tableProps.data;

  const localFilteringResetScope = React.useMemo(
    () =>
      JSON.stringify({
        pagination,
        sorting,
        columnFilters,
        editingScopeKey
      }),
    [columnFilters, editingScopeKey, pagination, sorting]
  );
  const localFiltering = useDataTableLocalFiltering({
    data: editingRows,
    columns: resolvedColumns,
    resetScope: localFilteringResetScope
  });

  const runtimeTableOptions = {
    data: localFiltering.data,
    columns: resolvedColumns,
    initialState: resolvedInitialState,
    pageCount: resolvedPageCount,
    rowCount: totalCount,
    meta: {
      rowNumberDisplayMode,
      rowNumberPagination,
      dataTableColumnOrder: {
        // 列面板通过 meta 调用 reset，不需要知道持久化实现细节。
        hasCustomOrder: hasCustomColumnOrder,
        reset: resetColumnOrder
      },
      dataTableId: tableId,
      dataTableEditing: editingEnabled ? editingState.runtime : undefined,
      dataTableLocalFiltering: localFiltering.runtime,
      dataTableRowActions: rowActions,
      enableZebraStriping: runtimeContext.enableZebraStriping
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
      // 默认关闭列筛选，只有 DSL/业务显式 filter 的列才出现在工具栏。
      minSize: 80,
      size: dataTableColumnSizes.md,
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
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: true,
    manualSorting: sortingMode === 'server',
    manualFiltering: true
  } satisfies Pick<TableOptions<TData>, DataTableRuntimeConfiguredTableOption>;

  const table = useReactTable({
    ...tableProps,
    ...runtimeTableOptions
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
    // 当前页数据变化后，如果展开行已不在 rowModel 中，自动关闭详情面板。
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
  // selectedRows/selectedRowIds 都只表达当前已加载 rowModel，不表达跨页选择。
  const selectedRows = getSelectedRows();
  const selectedRowIds = table
    .getRowModel()
    .rows.filter((row) => row.getIsSelected())
    .map((row) => row.id);
  const clearSelectedRows = React.useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);

  return {
    table,
    selectedRows,
    selectedRowIds,
    getSelectedRows,
    clearSelectedRows,
    resetColumnSizing,
    editing: editingState.controller,
    expandConfig,
    expandedRowKey,
    setExpandedRowKey,
    expandedRow,
    expandPanelId
  };
}
