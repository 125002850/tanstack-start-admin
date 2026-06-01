import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type ColumnSizingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  type VisibilityState,
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

import { DEFAULT_DATA_TABLE_PAGE_SIZE } from '@/lib/data-table-page-size';
import {
  loadColumnSizing,
  saveColumnSizing,
  clearColumnSizing
} from '@/lib/data-table-column-resize-storage';
import { dataTableConfig } from '@/config/data-table';
import type { ColumnResizeStorageMode, ExtendedColumnSort } from '@/types/data-table';
import {
  DataTableRowActions,
  DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE,
  getDataTableRowActionsColumnWidth,
  type DataTableRowAction
} from '@/components/ui/table/data-table-row-action';

const DEBOUNCE_MS = 300;
const DATA_TABLE_ROW_NUMBER_COLUMN_ID = '__rowNumber';
const DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH = 40;
const DATA_TABLE_ACTIONS_COLUMN_ID = 'actions';

type DataTablePinnedSide = 'left' | 'right';

interface UseDataTableProps<TData>
  extends
    Omit<
      TableOptions<TData>,
      | 'state'
      | 'pageCount'
      | 'getCoreRowModel'
      | 'manualFiltering'
      | 'manualPagination'
      | 'manualSorting'
    >,
    Required<Pick<TableOptions<TData>, 'pageCount'>> {
  /**
   * 表格初始状态。
   * `sorting` 支持 `ExtendedColumnSort<TData>[]` 以提供更精确的排序列类型推断。
   */
  initialState?: Omit<Partial<TableState>, 'sorting'> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  /** 路由历史模式：`push` 添加历史记录，`replace` 替换当前记录。 */
  history?: 'push' | 'replace';
  /** 列过滤搜索的去抖延迟（毫秒）。 */
  debounceMs?: number;
  /** 列过滤搜索的节流延迟（毫秒）。 */
  throttleMs?: number;
  /** 是否在查询参数为空时清除默认值。 */
  clearOnDefault?: boolean;
  /** 是否启用高级筛选模式。 */
  enableAdvancedFilter?: boolean;
  /** 受控的每页条数，覆盖默认值。 */
  pageSize?: number;
  /** 每页条数变化时的回调。 */
  onPageSizeChange?: (pageSize: number) => void;
  /** 是否启用滚动区域。 */
  scroll?: boolean;
  /** React 18+ 的 `startTransition` 函数，用于将状态更新标记为非紧急。 */
  startTransition?: React.TransitionStartFunction;
  /**
   * 表格唯一标识，用于列宽持久化存储的 key。
   * 传入后自动启用 localStorage / sessionStorage 列宽缓存。
   */
  tableId?: string;
  /**
   * 列宽持久化存储模式。
   * - `'localStorage'` — 持久存储（默认）
   * - `'sessionStorage'` — 会话存储
   * - `false` — 禁用持久化
   */
  columnResizeStorage?: ColumnResizeStorageMode;
  /** 列宽拖拽结束时的回调，仅在列宽实际变化时触发。 */
  onColumnResizeEnd?: (columnKey: string, width: number) => void;
  /** 是否在表格首列显示行号列。默认 `true`。 */
  showRowNumberColumn?: boolean;
  /** 操作列的固定方向。默认 `'right'`。 */
  actionColumnPin?: DataTablePinnedSide;
  /** 行操作配置列表。传入后自动在表格末尾生成操作列。 */
  rowActions?: DataTableRowAction<TData>[];
}

function createRowNumberColumn<TData>(): ColumnDef<TData> {
  return {
    id: DATA_TABLE_ROW_NUMBER_COLUMN_ID,
    header: () =>
      React.createElement('span', { className: 'block text-center text-xs font-medium' }, ''),
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      const rowNumber = pageIndex * pageSize + row.index + 1;
      return React.createElement(
        'span',
        { className: 'text-muted-foreground block text-center tabular-nums' },
        rowNumber
      );
    },
    size: DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH,
    minSize: DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH,
    maxSize: DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableColumnFilter: false,
    meta: {
      label: '序号'
    }
  };
}

function getColumnDefId<TData>(column: ColumnDef<TData>): string | undefined {
  if (typeof column.id === 'string') {
    return column.id;
  }

  if ('accessorKey' in column && typeof column.accessorKey === 'string') {
    return column.accessorKey;
  }

  return undefined;
}

function getFixedWidthColumnSizing<TData>(columns: ColumnDef<TData>[]): ColumnSizingState {
  return columns.reduce<ColumnSizingState>((acc, column) => {
    const columnId = getColumnDefId(column);

    if (
      !columnId ||
      column.enableResizing !== false ||
      typeof column.size !== 'number' ||
      column.minSize !== column.size ||
      column.maxSize !== column.size
    ) {
      return acc;
    }

    acc[columnId] = column.size;
    return acc;
  }, {});
}

function omitFixedWidthColumnSizing(
  columnSizing?: ColumnSizingState
): ColumnSizingState | undefined {
  if (!columnSizing) {
    return columnSizing;
  }

  let hasFixedWidthOverride = false;
  const rest: ColumnSizingState = {};

  for (const [columnId, width] of Object.entries(columnSizing)) {
    if (
      columnId === DATA_TABLE_ROW_NUMBER_COLUMN_ID ||
      columnId === 'select' ||
      columnId === DATA_TABLE_ACTIONS_COLUMN_ID
    ) {
      hasFixedWidthOverride = true;
      continue;
    }

    rest[columnId] = width;
  }

  return hasFixedWidthOverride ? rest : columnSizing;
}

function prependRowNumberColumnOrder(columnOrder?: string[]): string[] | undefined {
  if (!columnOrder) return columnOrder;

  return [
    DATA_TABLE_ROW_NUMBER_COLUMN_ID,
    ...columnOrder.filter((columnId) => columnId !== DATA_TABLE_ROW_NUMBER_COLUMN_ID)
  ];
}

function hasActionsColumn<TData>(columns: ColumnDef<TData>[]): boolean {
  return columns.some((column) => column.id === DATA_TABLE_ACTIONS_COLUMN_ID);
}

function createRowActionsColumn<TData>(rowActions: DataTableRowAction<TData>[]): ColumnDef<TData> {
  const actionColumnWidth = getDataTableRowActionsColumnWidth(
    rowActions.length,
    DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
  );

  return {
    id: DATA_TABLE_ACTIONS_COLUMN_ID,
    header: '操作',
    cell: ({ row }) =>
      React.createElement(DataTableRowActions<TData>, {
        row: row.original,
        actions: rowActions,
        maxVisible: DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
      }),
    size: actionColumnWidth,
    minSize: actionColumnWidth,
    maxSize: actionColumnWidth,
    enableSorting: false,
    enableResizing: false
  };
}

function normalizeActionColumn<TData>(column: ColumnDef<TData>): ColumnDef<TData> {
  if (column.id !== DATA_TABLE_ACTIONS_COLUMN_ID) {
    return column;
  }

  return {
    ...column,
    enableResizing: false
  };
}

function resolveActionColumnPinning(
  columnPinning: ColumnPinningState | undefined,
  hasPinnedActionsColumn: boolean,
  actionColumnPin: DataTablePinnedSide
): ColumnPinningState | undefined {
  if (!hasPinnedActionsColumn) {
    return columnPinning;
  }

  const left = (columnPinning?.left ?? []).filter(
    (columnId) => columnId !== DATA_TABLE_ACTIONS_COLUMN_ID
  );
  const right = (columnPinning?.right ?? []).filter(
    (columnId) => columnId !== DATA_TABLE_ACTIONS_COLUMN_ID
  );

  if (actionColumnPin === 'left') {
    left.push(DATA_TABLE_ACTIONS_COLUMN_ID);
  } else {
    right.push(DATA_TABLE_ACTIONS_COLUMN_ID);
  }

  return { left, right };
}

/**
 * Data-table hook managing pagination, sorting, column filters, column sizing,
 * row selection, column visibility, and column pinning via React state.
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
    ...tableProps
  } = props;

  const normalizedColumns = React.useMemo<ColumnDef<TData>[]>(
    () => columns.map((column) => normalizeActionColumn(column)),
    [columns]
  );

  const hasGeneratedRowActionsColumn = !!rowActions?.length;

  const baseColumns = React.useMemo<ColumnDef<TData>[]>(
    () =>
      hasGeneratedRowActionsColumn
        ? normalizedColumns.filter((column) => column.id !== DATA_TABLE_ACTIONS_COLUMN_ID)
        : normalizedColumns,
    [hasGeneratedRowActionsColumn, normalizedColumns]
  );

  const resolvedColumns = React.useMemo<ColumnDef<TData>[]>(
    () => {
      const columnsWithActions = hasGeneratedRowActionsColumn
        ? [...baseColumns, createRowActionsColumn(rowActions)]
        : baseColumns;

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
    () => baseColumns.some((column) => column.id === 'select'),
    [baseColumns]
  );

  const resolvedInitialState = React.useMemo(() => {
    if (!showRowNumberColumn && !hasPinnedActionsColumn && !hasSelectColumn) {
      return initialState;
    }

    let columnPinning = resolveActionColumnPinning(
      initialState?.columnPinning,
      hasPinnedActionsColumn,
      actionColumnPin
    );

    // Row number → select checkbox → actions → user-defined left columns
    if (showRowNumberColumn || hasSelectColumn || actionColumnPin === 'left') {
      const ordered: string[] = [];
      if (showRowNumberColumn) ordered.push(DATA_TABLE_ROW_NUMBER_COLUMN_ID);
      if (hasSelectColumn) ordered.push('select');
      if (hasPinnedActionsColumn && actionColumnPin === 'left') {
        ordered.push(DATA_TABLE_ACTIONS_COLUMN_ID);
      }

      const left = (columnPinning?.left ?? []).filter((id) => !ordered.includes(id));

      columnPinning = {
        ...columnPinning,
        left: ordered.length > 0 ? [...ordered, ...left] : left
      };
    }

    return {
      ...initialState,
      columnPinning,
      columnOrder: showRowNumberColumn
        ? prependRowNumberColumnOrder(initialState?.columnOrder)
        : initialState?.columnOrder,
      columnVisibility: showRowNumberColumn
        ? {
            ...initialState?.columnVisibility,
            [DATA_TABLE_ROW_NUMBER_COLUMN_ID]: true
          }
        : initialState?.columnVisibility,
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

  // ── Dev warning: tableId must not change at runtime ──────────────────
  const initialTableIdRef = React.useRef(props.tableId);
  React.useEffect(() => {
    if (
      import.meta.env.DEV &&
      props.tableId !== initialTableIdRef.current &&
      initialTableIdRef.current !== undefined
    ) {
      console.warn(
        `[useDataTable] tableId changed from "${initialTableIdRef.current}" to "${props.tableId}" at runtime. ` +
          'Column sizing persistence uses the initial tableId for storage keys. ' +
          'Changing tableId will cause mismatched storage reads/writes.'
      );
    }
  }, [props.tableId]);

  // ── Row selection / column visibility / column pinning (shared) ─────
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    resolvedInitialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    resolvedInitialState?.columnVisibility ?? {}
  );
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(
    resolvedInitialState?.columnPinning ?? {}
  );
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => ({
    ...resolvedInitialState?.columnSizing,
    ...omitFixedWidthColumnSizing(
      props.tableId ? loadColumnSizing(props.tableId, resolvedStorageMode) : {}
    )
  }));

  const onColumnSizingChange = React.useCallback((updaterOrValue: Updater<ColumnSizingState>) => {
    setColumnSizing((prev) => {
      const next =
        typeof updaterOrValue === 'function'
          ? (updaterOrValue as (prev: ColumnSizingState) => ColumnSizingState)(prev)
          : updaterOrValue;

      return omitFixedWidthColumnSizing(next) ?? {};
    });
  }, []);

  React.useEffect(() => {
    setColumnSizing((prev) => omitFixedWidthColumnSizing(prev) ?? prev);
  }, [fixedWidthColumnSizing]);

  // ── Pagination ──────────────────────────────────────────────────────
  const perPage = controlledPageSize ?? DEFAULT_DATA_TABLE_PAGE_SIZE;

  const [internalPagination, setInternalPagination] = React.useState<PaginationState>(() => ({
    pageIndex: resolvedInitialState?.pagination?.pageIndex ?? 0,
    pageSize: perPage
  }));

  const pagination = internalPagination;

  // Keep pageSize in sync with controlled prop changes
  React.useEffect(() => {
    setInternalPagination((prev) => {
      if (prev.pageSize === perPage) return prev;
      return { ...prev, pageSize: perPage };
    });
  }, [perPage]);

  const internalOnPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      setInternalPagination((prev) => {
        const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue;
        if (next.pageSize !== prev.pageSize) {
          onPageSizeChange?.(next.pageSize);
        }
        return next;
      });
    },
    [onPageSizeChange]
  );

  const onPaginationChange = internalOnPaginationChange;

  // ── Sorting ──────────────────────────────────────────────────────────
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    resolvedInitialState?.sorting ?? []
  );

  const sorting = internalSorting;

  const internalOnSortingChange = React.useCallback((updaterOrValue: Updater<SortingState>) => {
    setInternalSorting((prev) =>
      typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
    );
  }, []);

  const onSortingChange = internalOnSortingChange;

  // ── Column filters ───────────────────────────────────────────────────
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>(
    resolvedInitialState?.columnFilters ?? []
  );

  const columnFilters = internalColumnFilters;

  const internalOnColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return;
      setInternalColumnFilters((prev) =>
        typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
      );
    },
    [enableAdvancedFilter]
  );

  const onColumnFiltersChange = internalOnColumnFiltersChange;

  // ── React Table (exactly one call, always in the same position) ──────
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
    // 'onEnd' is the recommended mode for production — it only commits the new
    // column width on mouse-up, avoiding per-pixel re-renders during drag.
    // The resize handle provides visual feedback (cursor + indicator line)
    // during the drag via header.column.getIsResizing() / data-[resizing].
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

  // ── Seed prevSizingRef with initial sizing so the first resize-end
  //     only fires for columns that actually changed. ───────────────────

  const prevSizingRef = React.useRef<ColumnSizingState>({});

  React.useEffect(() => {
    prevSizingRef.current = table.getState().columnSizing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persistence: write to storage only on resize-end ─────────────────

  const prevIsResizingRef = React.useRef<string | false>(false);

  const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn;

  React.useEffect(() => {
    const wasResizing = !!prevIsResizingRef.current;
    const isResizing = !!isResizingColumn;
    prevIsResizingRef.current = isResizingColumn;

    if (wasResizing && !isResizing) {
      const currentSizing = table.getState().columnSizing;
      const sanitizedSizing = omitFixedWidthColumnSizing(currentSizing) ?? {};
      if (props.tableId && resolvedStorageMode !== false) {
        saveColumnSizing(
          props.tableId,
          sanitizedSizing as Record<string, number>,
          resolvedStorageMode
        );
      }
      if (props.onColumnResizeEnd) {
        const prev = prevSizingRef.current;
        for (const [key, width] of Object.entries(sanitizedSizing)) {
          if (typeof width === 'number' && prev[key] !== width) {
            props.onColumnResizeEnd(key, width);
          }
        }
      }
      prevSizingRef.current = { ...currentSizing };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizingColumn]);

  // ── Reset column sizing ──────────────────────────────────────────────

  const resetColumnSizing = React.useCallback(() => {
    if (props.tableId) {
      clearColumnSizing(props.tableId, resolvedStorageMode);
    }
    const nextColumnSizing = omitFixedWidthColumnSizing(resolvedInitialState?.columnSizing) ?? {};
    setColumnSizing(nextColumnSizing);
    prevSizingRef.current = nextColumnSizing;
  }, [props.tableId, resolvedStorageMode, resolvedInitialState?.columnSizing]);

  return { table, debounceMs, throttleMs: tableProps.throttleMs, resetColumnSizing };
}
