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

import { DEFAULT_DATA_TABLE_PAGE_SIZE } from '@/lib/data-table-page-size';
import { loadColumnSizing } from '@/lib/data-table-column-resize-storage';
import {
  areColumnOrdersEqual,
  clearColumnOrder,
  loadColumnOrder,
  saveColumnOrder
} from '@/lib/data-table-column-order-storage';
import type { ColumnOrderStorageMode, ColumnResizeStorageMode } from '@/types/data-table';

import { omitFixedWidthColumnSizing } from './column-sizing';
import type { UseDataTableProps } from './types';

/** 管理表格内部状态，保持 useDataTable 入口只负责装配。 */
export function useTableState<TData>({
  resolvedInitialState,
  controlledPageSize,
  onPageSizeChange,
  enableAdvancedFilter,
  tableId,
  rowSelectionScopeKey,
  resolvedStorageMode,
  resolvedColumnOrderStorageMode,
  normalizeColumnOrder,
  externalOnColumnOrderChange,
  fixedWidthColumnSizing
}: {
  resolvedInitialState: UseDataTableProps<TData>['initialState'];
  controlledPageSize: number | undefined;
  onPageSizeChange: ((pageSize: number) => void) | undefined;
  enableAdvancedFilter: boolean;
  tableId: string | undefined;
  rowSelectionScopeKey: UseDataTableProps<TData>['rowSelectionScopeKey'];
  resolvedStorageMode: ColumnResizeStorageMode;
  resolvedColumnOrderStorageMode: ColumnOrderStorageMode;
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
    const cachedOrder = tableId ? loadColumnOrder(tableId, resolvedColumnOrderStorageMode) : [];
    const initialOrder = cachedOrder.length > 0 ? cachedOrder : initialColumnOrderRef.current;

    return normalizeColumnOrder(initialOrder) ?? [];
  });
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => ({
    ...resolvedInitialState?.columnSizing,
    ...omitFixedWidthColumnSizing(tableId ? loadColumnSizing(tableId, resolvedStorageMode) : {})
  }));

  const persistColumnOrder = React.useCallback(
    (nextColumnOrder: ColumnOrderState) => {
      if (!tableId || resolvedColumnOrderStorageMode === false) return;

      if (areColumnOrdersEqual(nextColumnOrder, initialColumnOrderRef.current)) {
        clearColumnOrder(tableId, resolvedColumnOrderStorageMode);
        return;
      }

      saveColumnOrder(tableId, nextColumnOrder, resolvedColumnOrderStorageMode);
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
      clearColumnOrder(tableId, resolvedColumnOrderStorageMode);
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

  const [sorting, setSorting] = React.useState<SortingState>(resolvedInitialState?.sorting ?? []);

  const onSortingChange = React.useCallback((updaterOrValue: Updater<SortingState>) => {
    setSorting((prev) =>
      typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
    );
  }, []);

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

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return;
      setColumnFilters((prev) =>
        typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
      );
    },
    [enableAdvancedFilter]
  );

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
    hasCustomColumnOrder: !areColumnOrdersEqual(columnOrder, initialColumnOrderRef.current),
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
