import { flexRender, type Row, type Table as TanstackTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'
import { getCommonPinningStyles } from '@/lib/data-table'
import type { DataTableVirtualizationOptions } from '@/types/data-table'
import { DATA_TABLE_VIRTUAL_PRESET } from '@/config/data-table'
import { emitDataTableVirtualEvent } from '@/components/ui/table/data-table-virtual-events'

interface DataTableBodyProps<TData> {
  table: TanstackTable<TData>
  emptyMessage: string
  virtualization?: DataTableVirtualizationOptions
  scrollViewportRef: React.RefObject<HTMLDivElement | null>
}

const ESTIMATE_ROW_HEIGHT = DATA_TABLE_VIRTUAL_PRESET.estimateRowHeight
const DEFAULT_OVERSCAN = DATA_TABLE_VIRTUAL_PRESET.overscan
const DEFAULT_ROW_COUNT_THRESHOLD = DATA_TABLE_VIRTUAL_PRESET.rowCountThreshold

export function DataTableBody<TData>({
  table,
  emptyMessage,
  virtualization,
  scrollViewportRef,
}: DataTableBodyProps<TData>) {
  const prevKeyRef = useRef('')
  const [runtimeFallback, setRuntimeFallback] = useState(false)

  const rows = table.getRowModel().rows
  const shouldVirtualize =
    typeof window !== 'undefined' &&
    virtualization?.enabled === true &&
    rows.length >= (virtualization.rowCountThreshold ?? DEFAULT_ROW_COUNT_THRESHOLD) &&
    !runtimeFallback

  const estimateSize = useCallback(
    () => virtualization?.estimateRowHeight ?? ESTIMATE_ROW_HEIGHT,
    [virtualization?.estimateRowHeight],
  )

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize,
    overscan: virtualization?.overscan ?? DEFAULT_OVERSCAN,
    enabled: shouldVirtualize,
  })

  // Scroll reset — useLayoutEffect for pre-paint timing (Task 3 fix)
  useLayoutEffect(() => {
    const state = table.getState()
    const key = `${state.pagination.pageIndex}-${state.pagination.pageSize}-${JSON.stringify(state.sorting)}-${JSON.stringify(state.columnFilters)}`
    if (prevKeyRef.current && prevKeyRef.current !== key) {
      rowVirtualizer.scrollToIndex(0, { behavior: 'auto' })
    }
    prevKeyRef.current = key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    table.getState().pagination.pageIndex,
    table.getState().pagination.pageSize,
    table.getState().sorting,
    table.getState().columnFilters,
  ])

  // KeepAlive hidden guard: freeze when viewport rect is 0x0 (Task 3 fix)
  const frozenRef = useRef(false)
  useLayoutEffect(() => {
    const el = scrollViewportRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) {
          if (!frozenRef.current) {
            frozenRef.current = true
            emitDataTableVirtualEvent({ event: 'suspended-hidden' })
          }
        } else if (frozenRef.current) {
          frozenRef.current = false
          emitDataTableVirtualEvent({ event: 'resumed-visible' })
          rowVirtualizer.measure()
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollViewportRef.current])

  // Emit enabled event on first virtual render
  const enabledEmittedRef = useRef(false)

  if (!rows.length) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={table.getAllColumns().length} className='h-24 text-center'>
            {emptyMessage}
          </TableCell>
        </TableRow>
      </TableBody>
    )
  }

  if (shouldVirtualize) {
    if (!enabledEmittedRef.current) {
      enabledEmittedRef.current = true
      emitDataTableVirtualEvent({ event: 'enabled', count: rows.length })
    }

    try {
      const virtualItems = rowVirtualizer.getVirtualItems()
      const totalSize = rowVirtualizer.getTotalSize()
      const firstIndex = virtualItems[0]?.index ?? 0
      const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? 0

      return (
        <TableBody
          style={{ height: `${totalSize}px`, position: 'relative' }}
          aria-rowcount={rows.length + 1}
          data-virtual-enabled='true'
          data-virtual-count={virtualItems.length}
          data-virtual-total-size={totalSize}
          data-virtual-scroll-offset={virtualItems[0]?.start ?? 0}
          data-virtual-first-index={firstIndex}
          data-virtual-last-index={lastIndex}
        >
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index] as Row<TData>
            return (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                data-index={virtualRow.index}
                aria-rowindex={virtualRow.index + 2}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={getCommonPinningStyles({ column: cell.column })}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      )
    } catch {
      setRuntimeFallback(true)
      emitDataTableVirtualEvent({ event: 'runtime-error' })
      virtualization?.onVirtualizationFallback?.('runtime-error')
    }
  }

  return (
    <TableBody>
      {rows.map((row, index) => (
        <TableRow
          key={row.id}
          data-state={row.getIsSelected() && 'selected'}
          data-row-index={index}
        >
          {row.getVisibleCells().map((cell) => (
            <TableCell
              key={cell.id}
              style={getCommonPinningStyles({ column: cell.column })}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}
