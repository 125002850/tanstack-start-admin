import {
  flexRender,
  type Cell,
  type Row,
  type Table as TanstackTable
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type CSSProperties, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
  getColumnPinningShadow,
  getColumnPinningShadowOverlayStyle,
  getCommonPinningStyles
} from '@/lib/data-table';
import type {
  DataTableColumnRenderItem,
  DataTableColumnVirtualWindow,
  DataTableResolvedVirtualizationOptions
} from '@/types/data-table';
import { DATA_TABLE_VIRTUAL_PRESET } from '@/config/data-table';
import { emitDataTableVirtualEvent } from '@/components/ui/table/virtualization/data-table-virtual-events';
import { cn } from '@/lib/utils';
import { DataTableCellContent } from '@/components/ui/table/cells/data-table-cell-content';
import { Icons } from '@/components/icons';
import {
  DataTableStatus,
  type DataTableStatusConfig
} from '@/components/ui/table/feedback/data-table-status';
import { useDataTableCellSelection } from '@/components/ui/table/core/use-data-table-cell-selection';

interface DataTableBodyProps<TData> {
  table: TanstackTable<TData>;
  emptyMessage: React.ReactNode;
  status?: DataTableStatusConfig;
  virtualization?: DataTableResolvedVirtualizationOptions;
  columnVirtualWindow?: DataTableColumnVirtualWindow<TData>;
  useTransformFreeVirtualRows?: boolean;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
  headerRowRef: React.RefObject<HTMLTableRowElement | null>;
  onRowClick?: (rowKey: string) => void;
  expandedRowKey?: string | null;
  getExpandRowKey?: (row: TData) => string | null;
}

const ESTIMATE_ROW_HEIGHT = DATA_TABLE_VIRTUAL_PRESET.estimateRowHeight;
const DEFAULT_OVERSCAN = DATA_TABLE_VIRTUAL_PRESET.overscan;
const DEFAULT_ROW_COUNT_THRESHOLD = DATA_TABLE_VIRTUAL_PRESET.rowCountThreshold;
const ROW_EXPAND_IGNORE_SELECTOR = [
  '[data-row-expand-ignore]',
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="checkbox"]'
].join(',');
const DATA_TABLE_BODY_CELL_CLASS_NAME =
  'relative px-[15px] py-2 outline outline-1 outline-offset-[-1px] outline-transparent transition-[outline-color,box-shadow] duration-150 ease-out data-[cell-selected=true]:bg-primary/5 data-[cell-selected=true]:outline-primary data-[cell-selected=true]:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_20%,transparent)]';

function shouldIgnoreRowExpandTarget(target: EventTarget | null, currentTarget: HTMLElement) {
  if (!(target instanceof HTMLElement) || !currentTarget.contains(target)) {
    return true;
  }

  return Boolean(target.closest(ROW_EXPAND_IGNORE_SELECTOR));
}

function measureHeaderWidths(headerRow: HTMLTableRowElement): number[] {
  return Array.from(headerRow.querySelectorAll('th')).map((th) => th.offsetWidth);
}

function areColumnWidthsEqual(current: number[], next: number[]): boolean {
  if (current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== next[index]) {
      return false;
    }
  }

  return true;
}

function offsetPinnedCellByOnePixel(offset: CSSProperties['left']): CSSProperties['left'] {
  if (typeof offset === 'number') {
    return offset - 1;
  }

  if (typeof offset !== 'string') {
    return '-1px';
  }

  const pixelValue = Number.parseFloat(offset);
  if (Number.isFinite(pixelValue) && offset.trim().endsWith('px')) {
    return `${pixelValue - 1}px`;
  }

  return `calc(${offset} - 1px)`;
}

function getBodyCellPinningStyles<TData>(cell: Cell<TData, unknown>): CSSProperties {
  const pinningStyles = getCommonPinningStyles({ column: cell.column });
  const pinnedSide = cell.column.getIsPinned();

  if (pinnedSide === 'left') {
    return {
      ...pinningStyles,
      left: offsetPinnedCellByOnePixel(pinningStyles.left)
    };
  }

  if (pinnedSide === 'right') {
    return {
      ...pinningStyles,
      right: offsetPinnedCellByOnePixel(pinningStyles.right)
    };
  }

  return pinningStyles;
}

function renderDataTableCellSurface<TData>(cell: Cell<TData, unknown>, content: React.ReactNode) {
  const pinnedSide = cell.column.getIsPinned();

  if (!pinnedSide) {
    return content;
  }

  const pinningShadow = getColumnPinningShadow({ column: cell.column });
  let shadowEdge: 'left' | 'right' | undefined;
  let shadowStyle: CSSProperties | undefined;

  if (pinningShadow) {
    shadowEdge = pinnedSide === 'left' ? 'right' : 'left';
    shadowStyle = getColumnPinningShadowOverlayStyle(shadowEdge);
  }

  return (
    <>
      <div
        aria-hidden='true'
        data-slot='data-table-pinned-cell-base'
        data-pinning-shadow-edge={shadowEdge}
        className='bg-background group-data-[expanded=true]:bg-accent pointer-events-none absolute inset-0'
      />
      <div
        aria-hidden='true'
        data-slot='data-table-pinned-cell-overlay'
        data-pinning-shadow-edge={shadowEdge}
        className='group-hover:bg-muted/50 group-data-[state=selected]:bg-muted pointer-events-none absolute inset-0'
      />
      {shadowStyle ? (
        <div
          aria-hidden='true'
          data-slot='data-table-pinned-cell-shadow'
          data-pinning-shadow-edge={shadowEdge}
          className='pointer-events-none absolute top-0 bottom-0 z-[1]'
          style={shadowStyle}
        />
      ) : null}
      <div className='relative z-10 w-full'>{content}</div>
    </>
  );
}

function getColumnVirtualCellWidthStyle(size: number): React.CSSProperties {
  return {
    width: size,
    minWidth: size,
    maxWidth: size
  };
}

export function DataTableBody<TData>({
  table,
  emptyMessage,
  status,
  virtualization,
  columnVirtualWindow,
  useTransformFreeVirtualRows = false,
  scrollViewportRef,
  headerRowRef,
  onRowClick,
  expandedRowKey,
  getExpandRowKey
}: DataTableBodyProps<TData>) {
  const prevKeyRef = useRef('');
  const [runtimeFallback, setRuntimeFallback] = useState(false);
  const { getCellSelectionProps } = useDataTableCellSelection<TData>({
    shouldIgnoreTarget: shouldIgnoreRowExpandTarget
  });

  // Measured column widths from the real header cells — the single source of
  // truth for virtualized td widths (which sit outside the table flow).
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  const rows = table.getRowModel().rows;
  const shouldVirtualize =
    typeof window !== 'undefined' &&
    virtualization?.enabled === true &&
    rows.length >= (virtualization.rowCountThreshold ?? DEFAULT_ROW_COUNT_THRESHOLD) &&
    !runtimeFallback;

  const estimateSize = useCallback(
    () => virtualization?.estimateRowHeight ?? ESTIMATE_ROW_HEIGHT,
    [virtualization?.estimateRowHeight]
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize,
    overscan: virtualization?.overscan ?? DEFAULT_OVERSCAN,
    enabled: shouldVirtualize
  });

  useLayoutEffect(() => {
    if (!shouldVirtualize || !scrollViewportRef.current || rows.length === 0) {
      return;
    }

    rowVirtualizer.measure();
  }, [rowVirtualizer, rows.length, scrollViewportRef, shouldVirtualize]);

  // ── Measure actual header widths ──
  // ResizeObserver on each <th> catches all width changes (column resize,
  // window resize, toggling). No columnSizing dependency needed — the RO
  // handles everything.
  useLayoutEffect(() => {
    const headerRow = headerRowRef.current;
    if (!headerRow) return;

    const measure = () => {
      const nextWidths = measureHeaderWidths(headerRow);
      setColumnWidths((currentWidths) =>
        areColumnWidthsEqual(currentWidths, nextWidths) ? currentWidths : nextWidths
      );
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    const ths = headerRow.querySelectorAll('th');
    ths.forEach((th) => ro.observe(th));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerRowRef]);

  const pagination = table.getState().pagination;
  const sorting = table.getState().sorting;
  const columnFilters = table.getState().columnFilters;

  const handleRowClick = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (shouldIgnoreRowExpandTarget(event.target, event.currentTarget)) {
        return;
      }

      const rowKey = getExpandRowKey?.(row.original);
      if (!rowKey) {
        return;
      }

      onRowClick?.(rowKey);
    },
    [getExpandRowKey, onRowClick]
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      if (shouldIgnoreRowExpandTarget(event.target, event.currentTarget)) {
        return;
      }

      const rowKey = getExpandRowKey?.(row.original);
      if (!rowKey) {
        return;
      }

      event.preventDefault();
      onRowClick?.(rowKey);
    },
    [getExpandRowKey, onRowClick]
  );
  const getCellClassName = useCallback(
    (cell: Cell<TData, unknown>) =>
      cn(DATA_TABLE_BODY_CELL_CLASS_NAME, cell.column.getIsPinned() && 'bg-background'),
    []
  );

  const getRowClassName = useCallback(
    (row: Row<TData>) =>
      cn(
        expandedRowKey && getExpandRowKey?.(row.original) === expandedRowKey && '!bg-accent',
        onRowClick && 'cursor-pointer'
      ),
    [expandedRowKey, getExpandRowKey, onRowClick]
  );

  const getExpandableRowTabIndex = useCallback(
    (row: Row<TData>) => (onRowClick && getExpandRowKey?.(row.original) ? 0 : undefined),
    [getExpandRowKey, onRowClick]
  );

  // Scroll reset — useLayoutEffect for pre-paint timing (Task 3 fix)
  useLayoutEffect(() => {
    const key = `${pagination.pageIndex}-${pagination.pageSize}-${JSON.stringify(sorting)}-${JSON.stringify(columnFilters)}`;
    if (prevKeyRef.current && prevKeyRef.current !== key) {
      rowVirtualizer.scrollToIndex(0, { behavior: 'auto' });
    }
    prevKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageIndex, pagination.pageSize, sorting, columnFilters]);

  // KeepAlive hidden guard: freeze when viewport rect is 0x0 (Task 3 fix)
  const frozenRef = useRef(false);
  useLayoutEffect(() => {
    const el = scrollViewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) {
          if (!frozenRef.current) {
            frozenRef.current = true;
            emitDataTableVirtualEvent({ event: 'suspended-hidden' });
          }
        } else if (frozenRef.current) {
          frozenRef.current = false;
          emitDataTableVirtualEvent({ event: 'resumed-visible' });
          rowVirtualizer.measure();
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollViewportRef.current]);

  // Emit enabled event on first virtual render
  const enabledEmittedRef = useRef(false);
  const renderColumnVirtualSpacer = useCallback(
    (side: 'left' | 'right', size: number, isVirtualRow: boolean) => {
      if (size <= 0) return null;

      return (
        <TableCell
          key={`column-virtual-spacer-${side}`}
          aria-hidden='true'
          data-column-virtual-spacer={side}
          style={{
            ...getColumnVirtualCellWidthStyle(size),
            ...(isVirtualRow
              ? {
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%'
                }
              : {})
          }}
        />
      );
    },
    []
  );
  const renderColumnVirtualCell = useCallback(
    (row: Row<TData>, item: DataTableColumnRenderItem<TData>, isVirtualRow: boolean) => {
      const cell = row.getVisibleCells()[item.leafIndex] as Cell<TData, unknown> | undefined;
      if (!cell) return null;
      const pinningStyles = getBodyCellPinningStyles(cell);

      return (
        <TableCell
          key={cell.id}
          data-column-id={item.columnId}
          data-column-leaf-index={item.leafIndex}
          data-column-center-index={item.centerIndex >= 0 ? item.centerIndex : undefined}
          className={getCellClassName(cell)}
          {...getCellSelectionProps(cell)}
          style={{
            ...(isVirtualRow
              ? {
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%'
                }
              : {}),
            ...pinningStyles,
            ...getColumnVirtualCellWidthStyle(item.size)
          }}
        >
          {renderDataTableCellSurface(
            cell,
            <DataTableCellContent cell={cell}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </DataTableCellContent>
          )}
        </TableCell>
      );
    },
    [getCellClassName, getCellSelectionProps]
  );
  const renderColumnVirtualCells = useCallback(
    (row: Row<TData>, isVirtualRow: boolean) => {
      if (!columnVirtualWindow?.enabled) {
        return null;
      }

      return (
        <>
          {columnVirtualWindow.leftItems.map((item) =>
            renderColumnVirtualCell(row, item, isVirtualRow)
          )}
          {renderColumnVirtualSpacer('left', columnVirtualWindow.virtualPaddingLeft, isVirtualRow)}
          {columnVirtualWindow.items.map((item) =>
            renderColumnVirtualCell(row, item, isVirtualRow)
          )}
          {renderColumnVirtualSpacer(
            'right',
            columnVirtualWindow.virtualPaddingRight,
            isVirtualRow
          )}
          {columnVirtualWindow.rightItems.map((item) =>
            renderColumnVirtualCell(row, item, isVirtualRow)
          )}
        </>
      );
    },
    [columnVirtualWindow, renderColumnVirtualCell, renderColumnVirtualSpacer]
  );

  if (status) {
    return <DataTableStatus status={status} colSpan={table.getAllColumns().length} />;
  }

  if (!rows.length) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={table.getAllColumns().length}>
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Icons.search className='text-muted-foreground/30 mb-4 h-12 w-12' />
              <p className='text-muted-foreground text-sm font-medium'>{emptyMessage}</p>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  if (shouldVirtualize) {
    if (!enabledEmittedRef.current) {
      enabledEmittedRef.current = true;
      emitDataTableVirtualEvent({ event: 'enabled', count: rows.length });
    }

    try {
      const virtualItems = rowVirtualizer.getVirtualItems();
      const totalSize = rowVirtualizer.getTotalSize();
      const firstIndex = virtualItems[0]?.index ?? 0;
      const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;

      return (
        <TableBody
          style={{ height: `${totalSize}px`, position: 'relative' }}
          aria-rowcount={rows.length + 1}
          data-virtual-enabled='true'
          data-column-virtual-enabled={columnVirtualWindow?.enabled ? 'true' : undefined}
          data-column-virtual-count={
            columnVirtualWindow?.enabled ? columnVirtualWindow.items.length : undefined
          }
          data-virtual-count={virtualItems.length}
          data-virtual-total-size={totalSize}
          data-virtual-scroll-offset={virtualItems[0]?.start ?? 0}
          data-virtual-first-index={firstIndex}
          data-virtual-last-index={lastIndex}
        >
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index] as Row<TData>;
            return (
              <TableRow
                key={row.id}
                data-index={virtualRow.index}
                data-expanded={
                  expandedRowKey && getExpandRowKey?.(row.original) === expandedRowKey
                    ? 'true'
                    : undefined
                }
                aria-rowindex={virtualRow.index + 2}
                aria-selected={row.getIsSelected() ? true : undefined}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={getRowClassName(row)}
                onClick={(event) => handleRowClick(event, row)}
                onKeyDown={(event) => handleRowKeyDown(event, row)}
                tabIndex={getExpandableRowTabIndex(row)}
                style={{
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  top: useTransformFreeVirtualRows ? `${virtualRow.start}px` : 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: useTransformFreeVirtualRows
                    ? undefined
                    : `translateY(${virtualRow.start}px)`
                }}
                data-virtual-row-positioning={useTransformFreeVirtualRows ? 'top' : 'transform'}
              >
                {columnVirtualWindow?.enabled
                  ? renderColumnVirtualCells(row, true)
                  : row.getVisibleCells().map((cell, ci) => {
                      const measured = columnWidths[ci];
                      const thWidth =
                        measured ??
                        (headerRowRef.current
                          ? (
                              headerRowRef.current.querySelectorAll('th')[ci] as
                                | HTMLTableCellElement
                                | undefined
                            )?.offsetWidth
                          : undefined);
                      const pinningStyles = getBodyCellPinningStyles(cell);
                      return (
                        <TableCell
                          key={cell.id}
                          className={getCellClassName(cell)}
                          {...getCellSelectionProps(cell)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%',
                            ...pinningStyles,
                            // Measured header width wins over pinning's configured size.
                            // Fallback chain: measured → pinned configured → column default.
                            width:
                              thWidth ??
                              (pinningStyles.width as number | undefined) ??
                              cell.column.getSize()
                          }}
                        >
                          {renderDataTableCellSurface(
                            cell,
                            <DataTableCellContent cell={cell}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </DataTableCellContent>
                          )}
                        </TableCell>
                      );
                    })}
              </TableRow>
            );
          })}
        </TableBody>
      );
    } catch {
      setRuntimeFallback(true);
      emitDataTableVirtualEvent({ event: 'runtime-error' });
      virtualization?.onVirtualizationFallback?.('runtime-error');
    }
  }

  return (
    <TableBody
      data-column-virtual-enabled={columnVirtualWindow?.enabled ? 'true' : undefined}
      data-column-virtual-count={
        columnVirtualWindow?.enabled ? columnVirtualWindow.items.length : undefined
      }
    >
      {rows.map((row, index) => (
        <TableRow
          key={row.id}
          data-row-index={index}
          data-expanded={
            expandedRowKey && getExpandRowKey?.(row.original) === expandedRowKey
              ? 'true'
              : undefined
          }
          data-state={row.getIsSelected() ? 'selected' : undefined}
          aria-selected={row.getIsSelected() ? true : undefined}
          className={getRowClassName(row)}
          onClick={(event) => handleRowClick(event, row)}
          onKeyDown={(event) => handleRowKeyDown(event, row)}
          tabIndex={getExpandableRowTabIndex(row)}
        >
          {columnVirtualWindow?.enabled
            ? renderColumnVirtualCells(row, false)
            : row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={getCellClassName(cell)}
                  {...getCellSelectionProps(cell)}
                  style={getBodyCellPinningStyles(cell)}
                >
                  {renderDataTableCellSurface(
                    cell,
                    <DataTableCellContent cell={cell}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </DataTableCellContent>
                  )}
                </TableCell>
              ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
