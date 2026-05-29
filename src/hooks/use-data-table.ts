import {
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
} from '@tanstack/react-table'
import * as React from 'react'

import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { DEFAULT_DATA_TABLE_PAGE_SIZE } from '@/lib/data-table-page-size'
import { loadColumnSizing, saveColumnSizing, clearColumnSizing } from '@/lib/data-table-column-resize-storage'
import { parseSortingState, serializeSortingState } from '@/lib/parsers'
import { dataTableConfig } from '@/config/data-table'
import type { ColumnResizeStorageMode, ExtendedColumnSort } from '@/types/data-table'
import type { DataTableSearchAdapter } from '@/features/workspace-tabs/types'
import {
  buildPaginationSearch,
  buildSortSearch,
  buildFilterSearch,
} from '@/features/workspace-tabs/lib/workspace-route-state'

const ARRAY_SEPARATOR = ','
const DEBOUNCE_MS = 300
const EMPTY_SEARCH = Object.freeze({}) as Record<string, unknown>

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
  initialState?: Omit<Partial<TableState>, 'sorting'> & {
    sorting?: ExtendedColumnSort<TData>[]
  }
  history?: 'push' | 'replace'
  debounceMs?: number
  throttleMs?: number
  clearOnDefault?: boolean
  enableAdvancedFilter?: boolean
  pageSize?: number
  onPageSizeChange?: (pageSize: number) => void
  scroll?: boolean
  shallow?: boolean
  startTransition?: React.TransitionStartFunction
  /** @deprecated Use internal-state mode (default) instead. The searchAdapter path
   *  is preserved for backward compatibility during V2 migration. */
  searchAdapter?: DataTableSearchAdapter
  tableId?: string
  columnResizeStorage?: ColumnResizeStorageMode
  onColumnResizeEnd?: (columnKey: string, width: number) => void
}

/**
 * Unified data-table hook with two modes sharing a stable hook order.
 *
 * All React hooks are called unconditionally at the top level so that
 * `searchAdapter` can safely change across renders without violating the
 * Rules of Hooks. The mode only selects which state/handler values are
 * passed to useReactTable — it never gates hook calls.
 *
 * 1. **Internal-state mode (default)** — pagination, sorting, and column filters
 *    are managed entirely within the hook via React state.
 *
 * 2. **searchAdapter mode (deprecated)** — state is bridged through a
 *    DataTableSearchAdapter for URL-synced workflows.
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
    shallow = true,
    searchAdapter,
    ...tableProps
  } = props

  const resolvedStorageMode: ColumnResizeStorageMode = React.useMemo(
    () => (props.columnResizeStorage ?? dataTableConfig.columnResizeStorage) as ColumnResizeStorageMode,
    [props.columnResizeStorage],
  )

  // ── Row selection / column visibility / column pinning (shared) ─────
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  )
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialState?.columnVisibility ?? {}
  )
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(
    initialState?.columnPinning ?? {}
  )
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => ({
    ...initialState?.columnSizing,
    ...(props.tableId
      ? loadColumnSizing(props.tableId, resolvedStorageMode)
      : {}),
  }))

  const onColumnSizingChange = React.useCallback(
    (updaterOrValue: Updater<ColumnSizingState>) => {
      setColumnSizing((prev) =>
        typeof updaterOrValue === 'function'
          ? (updaterOrValue as (prev: ColumnSizingState) => ColumnSizingState)(prev)
          : updaterOrValue,
      )
    },
    [],
  )

  // ── Adapter search snapshot (always called for hook-order stability) ─
  // useSyncExternalStore calls getSnapshot during render — the returned
  // value always reflects the CURRENT adapter, even on identity switch.
  // No useEffect lag, no stale frame, no render-phase setState.
  const adapterSearch = React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange: () => void) => {
        if (!searchAdapter?.subscribe) return () => {}
        return searchAdapter.subscribe(onStoreChange)
      },
      [searchAdapter],
    ),
    React.useCallback(
      () => searchAdapter?.getSearch() ?? EMPTY_SEARCH,
      [searchAdapter],
    ),
    // getServerSnapshot: SSR-safe fallback. On the server there is no
    // real adapter to subscribe to, so we return the same frozen empty
    // object. This prevents "Missing getServerSnapshot" errors during
    // server-side rendering while keeping a stable reference.
    React.useCallback(
      () => searchAdapter?.getSearch() ?? EMPTY_SEARCH,
      [searchAdapter],
    ),
  )

  // Stable ref for the latest adapter snapshot — used by setSearch to
  // avoid stale closures without putting adapter writes inside updaters.
  const adapterSearchRef = React.useRef(adapterSearch)
  adapterSearchRef.current = adapterSearch

  // Pure setSearch: read current snapshot via ref (no stale closure),
  // write to adapter OUTSIDE any React state updater. The subscribe
  // callback above feeds the new value back through useSyncExternalStore.
  const setSearch = React.useCallback(
    (reducer: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      if (!searchAdapter) return
      const next = reducer(adapterSearchRef.current)
      searchAdapter.setSearch(() => next)
    },
    [searchAdapter],
  )

  const adapterMode = !!searchAdapter
  const search = adapterMode ? adapterSearch : EMPTY_SEARCH

  // ── Pagination ──────────────────────────────────────────────────────
  const perPage = controlledPageSize ?? DEFAULT_DATA_TABLE_PAGE_SIZE

  const [internalPagination, setInternalPagination] = React.useState<PaginationState>(() => ({
    pageIndex: initialState?.pagination?.pageIndex ?? 0,
    pageSize: perPage,
  }))

  const adapterPage = (search.page as number) ?? 1
  const adapterPerPage = controlledPageSize ?? (search.perPage as number) ?? DEFAULT_DATA_TABLE_PAGE_SIZE
  const adapterPagination: PaginationState = React.useMemo(
    () => ({ pageIndex: adapterPage - 1, pageSize: adapterPerPage }),
    [adapterPage, adapterPerPage],
  )

  const pagination = adapterMode ? adapterPagination : internalPagination

  // Keep pageSize in sync with controlled prop changes (internal mode only)
  React.useEffect(() => {
    if (adapterMode) return
    setInternalPagination((prev) => {
      if (prev.pageSize === perPage) return prev
      return { ...prev, pageSize: perPage }
    })
  }, [perPage, adapterMode])

  const internalOnPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      setInternalPagination((prev) => {
        const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
        if (next.pageSize !== prev.pageSize) {
          onPageSizeChange?.(next.pageSize)
        }
        return next
      })
    },
    [onPageSizeChange],
  )

  const adapterOnPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      const newPagination =
        typeof updaterOrValue === 'function' ? updaterOrValue(pagination) : updaterOrValue
      if (newPagination.pageSize !== pagination.pageSize) {
        onPageSizeChange?.(newPagination.pageSize)
      }
      setSearch((prev: Record<string, unknown>) =>
        buildPaginationSearch(prev, newPagination.pageIndex, newPagination.pageSize, pagination.pageSize),
      )
    },
    [onPageSizeChange, pagination, setSearch],
  )

  const onPaginationChange = adapterMode ? adapterOnPaginationChange : internalOnPaginationChange

  // ── Sorting ──────────────────────────────────────────────────────────
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    initialState?.sorting ?? []
  )

  const columnIds = React.useMemo(() => {
    return new Set(columns.map((column) => column.id).filter(Boolean) as string[])
  }, [columns])

  const adapterSorting = React.useMemo(
    () =>
      parseSortingState<TData>(search.sort as string | undefined, columnIds) ??
      initialState?.sorting ??
      [],
    [search.sort, columnIds, initialState?.sorting],
  )

  const sorting = adapterMode ? adapterSorting : internalSorting

  const internalOnSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      setInternalSorting((prev) =>
        typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue,
      )
    },
    [],
  )

  const adapterOnSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      const newSorting =
        typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue
      setSearch((prev: Record<string, unknown>) =>
        buildSortSearch(
          prev,
          newSorting.length > 0
            ? serializeSortingState(newSorting as ExtendedColumnSort<TData>[])
            : undefined,
        ),
      )
    },
    [sorting, setSearch],
  )

  const onSortingChange = adapterMode ? adapterOnSortingChange : internalOnSortingChange

  // ── Column filters ───────────────────────────────────────────────────
  const filterableColumns = React.useMemo(() => {
    if (enableAdvancedFilter) return []
    return columns.filter((column) => column.enableColumnFilter)
  }, [columns, enableAdvancedFilter])

  const filterValues = React.useMemo(() => {
    if (enableAdvancedFilter || !adapterMode) return {}
    const values: Record<string, string | string[] | null> = {}
    for (const column of filterableColumns) {
      const key = column.id ?? ''
      const val = search[key]
      if (val !== undefined && val !== null) {
        if (column.meta?.options) {
          values[key] = typeof val === 'string' ? val.split(ARRAY_SEPARATOR) : null
        } else {
          values[key] = typeof val === 'string' ? val : null
        }
      } else {
        values[key] = null
      }
    }
    return values
  }, [search, filterableColumns, enableAdvancedFilter, adapterMode])

  const debouncedSetFilterValues = useDebouncedCallback(
    (values: Record<string, string | string[] | null>) => {
      if (!adapterMode) return
      setSearch((prev: Record<string, unknown>) =>
        buildFilterSearch(prev, values, ARRAY_SEPARATOR),
      )
    },
    debounceMs,
  )

  const initialColumnFilters: ColumnFiltersState = React.useMemo(() => {
    if (enableAdvancedFilter || !adapterMode) return []
    return Object.entries(filterValues).reduce<ColumnFiltersState>((filters, [key, value]) => {
      if (value !== null) {
        filters.push({ id: key, value })
      }
      return filters
    }, [])
  }, [filterValues, enableAdvancedFilter, adapterMode])

  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>(
    initialState?.columnFilters ?? []
  )

  const [adapterColumnFilters, setAdapterColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters)

  React.useEffect(() => {
    if (!adapterMode) return
    setAdapterColumnFilters(initialColumnFilters)
  }, [initialColumnFilters, adapterMode])

  const columnFilters = adapterMode ? adapterColumnFilters : internalColumnFilters

  const internalOnColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return
      setInternalColumnFilters((prev) =>
        typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue,
      )
    },
    [enableAdvancedFilter],
  )

  const adapterOnColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return
      setAdapterColumnFilters((prev) => {
        const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
        const filterUpdates: Record<string, string | string[] | null> = {}
        for (const filter of next) {
          if (filterableColumns.find((column) => column.id === filter.id)) {
            filterUpdates[filter.id] = filter.value as string | string[]
          }
        }
        for (const prevFilter of prev) {
          if (!next.some((filter) => filter.id === prevFilter.id)) {
            filterUpdates[prevFilter.id] = null
          }
        }
        debouncedSetFilterValues(filterUpdates)
        return next
      })
    },
    [debouncedSetFilterValues, filterableColumns, enableAdvancedFilter],
  )

  const onColumnFiltersChange = adapterMode
    ? adapterOnColumnFiltersChange
    : internalOnColumnFiltersChange

  // ── React Table (exactly one call, always in the same position) ──────
  const table = useReactTable({
    ...tableProps,
    columns,
    initialState,
    pageCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      columnPinning,
      rowSelection,
      columnFilters,
      columnSizing,
    },
    defaultColumn: {
      minSize: 80,
      size: 150,
      ...tableProps.defaultColumn,
      enableColumnFilter: false,
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
    manualFiltering: true,
  })

  // ── Seed prevSizingRef with initial sizing so the first resize-end
  //     only fires for columns that actually changed. ───────────────────

  const prevSizingRef = React.useRef<ColumnSizingState>({})

  React.useEffect(() => {
    prevSizingRef.current = table.getState().columnSizing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Persistence: write to storage only on resize-end ─────────────────

  const prevIsResizingRef = React.useRef<string | false>(false)

  const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn

  React.useEffect(() => {
    const wasResizing = !!prevIsResizingRef.current
    const isResizing = !!isResizingColumn
    prevIsResizingRef.current = isResizingColumn

    if (wasResizing && !isResizing) {
      const currentSizing = table.getState().columnSizing
      if (props.tableId && resolvedStorageMode !== false) {
        saveColumnSizing(
          props.tableId,
          currentSizing as Record<string, number>,
          resolvedStorageMode,
        )
      }
      if (props.onColumnResizeEnd) {
        const prev = prevSizingRef.current
        for (const [key, width] of Object.entries(currentSizing)) {
          if (typeof width === 'number' && prev[key] !== width) {
            props.onColumnResizeEnd(key, width)
          }
        }
      }
      prevSizingRef.current = { ...currentSizing }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizingColumn])

  // ── Reset column sizing ──────────────────────────────────────────────

  const resetColumnSizing = React.useCallback(() => {
    if (props.tableId) {
      clearColumnSizing(props.tableId, resolvedStorageMode)
    }
    setColumnSizing(initialState?.columnSizing ?? {})
    prevSizingRef.current = initialState?.columnSizing ?? {}
  }, [props.tableId, resolvedStorageMode, initialState?.columnSizing])

  return { table, shallow, debounceMs, throttleMs: tableProps.throttleMs, resetColumnSizing }
}
