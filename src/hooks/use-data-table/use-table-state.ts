import {
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState
} from '@tanstack/react-table';
import * as React from 'react';

import {
  areDataTableColumnOrdersEqual,
  areDataTableSortingStatesEqual,
  clearDataTableColumnOrder,
  clearDataTableSorting,
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  loadDataTableColumnOrder,
  loadDataTableColumnSizing,
  readDataTableSorting,
  saveDataTableColumnOrder,
  saveDataTableSorting
} from '@/lib/data-table-state-persistence';
import type {
  ColumnOrderStorageMode,
  ColumnResizeStorageMode,
  SortingStorageMode
} from '@/types/data-table';

import { omitFixedWidthColumnSizing } from './column-sizing';
import type { UseDataTableProps } from './types';

/** 管理表格内部状态，保持 useDataTable 入口只负责装配。 */
export function useTableState<TData>({
  resolvedInitialState,
  controlledPageSize,
  onPageSizeChange,
  tableId,
  rowSelectionScopeKey,
  resolvedStorageMode,
  resolvedColumnOrderStorageMode,
  resolvedSortingStorageMode,
  normalizeColumnOrder,
  externalOnColumnOrderChange,
  fixedWidthColumnSizing
}: {
  resolvedInitialState: UseDataTableProps<TData>['initialState'];
  controlledPageSize: number | undefined;
  onPageSizeChange: ((pageSize: number) => void) | undefined;
  tableId: string | undefined;
  rowSelectionScopeKey: UseDataTableProps<TData>['rowSelectionScopeKey'];
  resolvedStorageMode: ColumnResizeStorageMode;
  resolvedColumnOrderStorageMode: ColumnOrderStorageMode;
  resolvedSortingStorageMode: SortingStorageMode;
  normalizeColumnOrder: (columnOrder: ColumnOrderState | undefined) => ColumnOrderState | undefined;
  externalOnColumnOrderChange: UseDataTableProps<TData>['onColumnOrderChange'];
  fixedWidthColumnSizing: ColumnSizingState;
}) {
  // rowSelection、columnVisibility、columnPinning 都保持纯内存状态，不做持久化。
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    resolvedInitialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    resolvedInitialState?.columnVisibility ?? {}
  );
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(
    resolvedInitialState?.columnPinning ?? {}
  );
  const initialColumnOrderRef = React.useRef<ColumnOrderState>(
    normalizeColumnOrder(resolvedInitialState?.columnOrder) ?? []
  );
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
    // 列顺序优先恢复缓存；没有缓存时才使用 initialState。
    const cachedOrder = tableId
      ? loadDataTableColumnOrder(tableId, resolvedColumnOrderStorageMode)
      : [];
    const initialOrder = cachedOrder.length > 0 ? cachedOrder : initialColumnOrderRef.current;

    return normalizeColumnOrder(initialOrder) ?? [];
  });
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => ({
    ...resolvedInitialState?.columnSizing,
    // 持久化列宽不能覆盖固定宽度工具列，所以恢复时先做 omitFixedWidthColumnSizing。
    ...omitFixedWidthColumnSizing(
      tableId ? loadDataTableColumnSizing(tableId, resolvedStorageMode) : {}
    )
  }));
  const initialSortingRef = React.useRef<SortingState>(resolvedInitialState?.sorting ?? []);
  const [sorting, setSorting] = React.useState<SortingState>(() => {
    // 排序缓存和 initialState 二选一，缓存表示用户已经做过显式调整。
    const cachedSorting = tableId
      ? readDataTableSorting(tableId, resolvedSortingStorageMode)
      : null;

    return cachedSorting ?? initialSortingRef.current;
  });

  const persistColumnOrder = React.useCallback(
    (nextColumnOrder: ColumnOrderState) => {
      if (!tableId || resolvedColumnOrderStorageMode === false) return;

      if (areDataTableColumnOrdersEqual(nextColumnOrder, initialColumnOrderRef.current)) {
        // 回到初始顺序时删除缓存，避免 localStorage 长期保留无意义数据。
        clearDataTableColumnOrder(tableId, resolvedColumnOrderStorageMode);
        return;
      }

      saveDataTableColumnOrder(tableId, nextColumnOrder, resolvedColumnOrderStorageMode);
    },
    [resolvedColumnOrderStorageMode, tableId]
  );

  const onColumnOrderChange = React.useCallback(
    (updaterOrValue: Updater<ColumnOrderState>) => {
      setColumnOrder((prev) => {
        const nextRaw =
          typeof updaterOrValue === 'function'
            ? (updaterOrValue as (prev: ColumnOrderState) => ColumnOrderState)(prev)
            : updaterOrValue;
        const next = normalizeColumnOrder(nextRaw) ?? [];

        // 先持久化再更新本地 state，确保外部回调读到的是同一个 next。
        persistColumnOrder(next);
        return next;
      });

      externalOnColumnOrderChange?.(updaterOrValue);
    },
    [externalOnColumnOrderChange, normalizeColumnOrder, persistColumnOrder]
  );

  const resetColumnOrder = React.useCallback(() => {
    if (tableId) {
      clearDataTableColumnOrder(tableId, resolvedColumnOrderStorageMode);
    }

    const nextColumnOrder = initialColumnOrderRef.current;
    // reset 同时通知外部受控监听方，保持内部/外部列顺序一致。
    setColumnOrder(nextColumnOrder);
    externalOnColumnOrderChange?.(nextColumnOrder);
  }, [externalOnColumnOrderChange, resolvedColumnOrderStorageMode, tableId]);

  const onColumnSizingChange = React.useCallback((updaterOrValue: Updater<ColumnSizingState>) => {
    setColumnSizing((prev) => {
      const next =
        typeof updaterOrValue === 'function'
          ? (updaterOrValue as (prev: ColumnSizingState) => ColumnSizingState)(prev)
          : updaterOrValue;

      // 固定宽度工具列的列宽由定义决定，用户拖拽/缓存都不能覆盖。
      return omitFixedWidthColumnSizing(next) ?? {};
    });
  }, []);

  React.useEffect(() => {
    // resolvedColumns 变化后重新剔除固定宽度列，防止旧缓存污染新列结构。
    setColumnSizing((prev) => omitFixedWidthColumnSizing(prev) ?? prev);
  }, [fixedWidthColumnSizing]);

  const perPage = controlledPageSize ?? DEFAULT_DATA_TABLE_PAGE_SIZE;

  const [pagination, setPagination] = React.useState<PaginationState>(() => ({
    pageIndex: resolvedInitialState?.pagination?.pageIndex ?? 0,
    pageSize: perPage
  }));

  React.useEffect(() => {
    // 受控 pageSize 改变时同步到 pagination，但保留当前 pageIndex。
    setPagination((prev) => {
      if (prev.pageSize === perPage) return prev;
      return { ...prev, pageSize: perPage };
    });
  }, [perPage]);

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      setPagination((prev) => {
        const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue;
        if (next.pageSize !== prev.pageSize) {
          // pageSize 变化向上传递，由调用方决定是否持久化或同步 URL。
          onPageSizeChange?.(next.pageSize);
        }
        return next;
      });
    },
    [onPageSizeChange]
  );

  const persistSorting = React.useCallback(
    (nextSorting: SortingState) => {
      if (!tableId || resolvedSortingStorageMode === false) return;

      if (areDataTableSortingStatesEqual(nextSorting, initialSortingRef.current)) {
        // 排序回到初始值时清缓存，避免默认排序被永久写死。
        clearDataTableSorting(tableId, resolvedSortingStorageMode);
        return;
      }

      saveDataTableSorting(tableId, nextSorting, resolvedSortingStorageMode);
    },
    [resolvedSortingStorageMode, tableId]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      setSorting((prev) => {
        const next =
          typeof updaterOrValue === 'function'
            ? (updaterOrValue as (prev: SortingState) => SortingState)(prev)
            : updaterOrValue;

        persistSorting(next);
        return next;
      });
    },
    [persistSorting]
  );

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    resolvedInitialState?.columnFilters ?? []
  );

  const previousRowSelectionScopeKeyRef = React.useRef(rowSelectionScopeKey);

  React.useEffect(() => {
    if (previousRowSelectionScopeKeyRef.current === rowSelectionScopeKey) {
      return;
    }

    previousRowSelectionScopeKeyRef.current = rowSelectionScopeKey;
    // 数据上下文切换后清空选择，避免把上一批数据的 row id 套到当前列表。
    setRowSelection({});
  }, [rowSelectionScopeKey]);

  const onColumnFiltersChange = React.useCallback((updaterOrValue: Updater<ColumnFiltersState>) => {
    setColumnFilters((prev) =>
      typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
    );
  }, []);

  return {
    rowSelection,
    setRowSelection,
    columnVisibility,
    setColumnVisibility,
    columnPinning,
    setColumnPinning,
    columnOrder,
    onColumnOrderChange,
    resetColumnOrder,
    hasCustomColumnOrder: !areDataTableColumnOrdersEqual(
      columnOrder,
      initialColumnOrderRef.current
    ),
    columnSizing,
    setColumnSizing,
    onColumnSizingChange,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    columnFilters,
    onColumnFiltersChange
  };
}
