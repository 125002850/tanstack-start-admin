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

import { DEFAULT_DATA_TABLE_PAGE_SIZE } from '@/lib/data-table-page-size'
import { loadColumnSizing, saveColumnSizing, clearColumnSizing } from '@/lib/data-table-column-resize-storage'
import { dataTableConfig } from '@/config/data-table'
import type { ColumnResizeStorageMode, ExtendedColumnSort } from '@/types/data-table'

const DEBOUNCE_MS = 300

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
  startTransition?: React.TransitionStartFunction
  tableId?: string
  columnResizeStorage?: ColumnResizeStorageMode
  onColumnResizeEnd?: (columnKey: string, width: number) => void
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

  // ── Pagination ──────────────────────────────────────────────────────
  const perPage = controlledPageSize ?? DEFAULT_DATA_TABLE_PAGE_SIZE

  const [internalPagination, setInternalPagination] = React.useState<PaginationState>(() => ({
    pageIndex: initialState?.pagination?.pageIndex ?? 0,
    pageSize: perPage,
  }))

  const pagination = internalPagination

  // Keep pageSize in sync with controlled prop changes
  React.useEffect(() => {
    setInternalPagination((prev) => {
      if (prev.pageSize === perPage) return prev
      return { ...prev, pageSize: perPage }
    })
  }, [perPage])

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

  const onPaginationChange = internalOnPaginationChange

  // ── Sorting ──────────────────────────────────────────────────────────
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    initialState?.sorting ?? []
  )

  const sorting = internalSorting

  const internalOnSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      setInternalSorting((prev) =>
        typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue,
      )
    },
    [],
  )

  const onSortingChange = internalOnSortingChange

  // ── Column filters ───────────────────────────────────────────────────
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>(
    initialState?.columnFilters ?? []
  )

  const columnFilters = internalColumnFilters

  const internalOnColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return
      setInternalColumnFilters((prev) =>
        typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue,
      )
    },
    [enableAdvancedFilter],
  )

  const onColumnFiltersChange = internalOnColumnFiltersChange

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

  return { table, debounceMs, throttleMs: tableProps.throttleMs, resetColumnSizing }
}
