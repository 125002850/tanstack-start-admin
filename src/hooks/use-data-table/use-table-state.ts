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
    const cachedOrder = tableId
      ? loadDataTableColumnOrder(tableId, resolvedColumnOrderStorageMode)
      : [];
    const initialOrder = cachedOrder.length > 0 ? cachedOrder : initialColumnOrderRef.current;

    return normalizeColumnOrder(initialOrder) ?? [];
  });
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => ({
    ...resolvedInitialState?.columnSizing,
    ...omitFixedWidthColumnSizing(
      tableId ? loadDataTableColumnSizing(tableId, resolvedStorageMode) : {}
    )
  }));
  const initialSortingRef = React.useRef<SortingState>(resolvedInitialState?.sorting ?? []);
  const [sorting, setSorting] = React.useState<SortingState>(() => {
    const cachedSorting = tableId
      ? readDataTableSorting(tableId, resolvedSortingStorageMode)
      : null;

    return cachedSorting ?? initialSortingRef.current;
  });

  const persistColumnOrder = React.useCallback(
    (nextColumnOrder: ColumnOrderState) => {
      if (!tableId || resolvedColumnOrderStorageMode === false) return;

      if (areDataTableColumnOrdersEqual(nextColumnOrder, initialColumnOrderRef.current)) {
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
    setColumnOrder(nextColumnOrder);
    externalOnColumnOrderChange?.(nextColumnOrder);
  }, [externalOnColumnOrderChange, resolvedColumnOrderStorageMode, tableId]);

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

  const perPage = controlledPageSize ?? DEFAULT_DATA_TABLE_PAGE_SIZE;

  const [pagination, setPagination] = React.useState<PaginationState>(() => ({
    pageIndex: resolvedInitialState?.pagination?.pageIndex ?? 0,
    pageSize: perPage
  }));

  React.useEffect(() => {
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
