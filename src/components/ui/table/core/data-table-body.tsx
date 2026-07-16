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
import {
  resolveDataTableColumnDragCellMotion,
  type DataTableColumnDragMotionMap
} from '@/components/ui/table/dnd/data-table-column-drag-motion';

/**
 * DataTable 的 tbody 渲染层。
 *
 * 这里负责空态/状态行、普通行渲染、行虚拟化、列虚拟化、固定列视觉层、
 * 行点击展开以及单元格复制反馈。核心原则是：表体只消费 TanStack row/cell，
 * 不修改上层 table state。
 */
interface DataTableBodyProps<TData> {
  table: TanstackTable<TData>;
  enableZebraStriping: boolean;
  emptyMessage: React.ReactNode;
  status?: DataTableStatusConfig;
  virtualization?: DataTableResolvedVirtualizationOptions;
  columnVirtualWindow?: DataTableColumnVirtualWindow<TData>;
  columnDragMotionById: DataTableColumnDragMotionMap;
  isColumnDragging: boolean;
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
  'relative px-[15px] py-2 outline outline-1 outline-offset-[-1px] outline-transparent transition-[outline-color,box-shadow] duration-150 ease-out';

/** 行展开点击需要避开按钮、链接、表单控件等交互元素。 */
function shouldIgnoreRowExpandTarget(target: EventTarget | null, currentTarget: HTMLElement) {
  if (!(target instanceof HTMLElement) || !currentTarget.contains(target)) {
    return true;
  }

  return Boolean(target.closest(ROW_EXPAND_IGNORE_SELECTOR));
}

/** 虚拟行脱离原生表格布局后，必须按 column id 从真实 th 读取列宽来对齐 td。 */
function measureHeaderWidths(headerRow: HTMLTableRowElement): ReadonlyMap<string, number> {
  const widths = new Map<string, number>();

  for (const th of headerRow.querySelectorAll<HTMLTableCellElement>('th[data-column-id]')) {
    const columnId = th.dataset.columnId;
    if (columnId) {
      widths.set(columnId, th.offsetWidth);
    }
  }

  return widths;
}

/** 首次布局测量完成前，直接按 column id 从现有 header DOM 读取对应宽度。 */
function getHeaderWidth(headerRow: HTMLTableRowElement, columnId: string): number | undefined {
  for (const th of headerRow.querySelectorAll<HTMLTableCellElement>('th[data-column-id]')) {
    if (th.dataset.columnId === columnId) {
      return th.offsetWidth;
    }
  }

  return undefined;
}

/** 宽度映射相同则复用旧 state，减少 ResizeObserver 高频回调导致的重复渲染。 */
function areColumnWidthsEqual(
  current: ReadonlyMap<string, number>,
  next: ReadonlyMap<string, number>
): boolean {
  if (current.size !== next.size) {
    return false;
  }

  for (const [columnId, width] of current) {
    if (next.get(columnId) !== width) {
      return false;
    }
  }

  return true;
}

/** 固定列单元格向外偏移 1px，覆盖表格边框缝隙，避免滚动时出现细白线。 */
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

/** 表体固定列样式在公共 fixed 样式基础上修正左右偏移。 */
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

/**
 * 固定列单元格的视觉层。
 *
 * 背景层、hover/selected 覆盖层和阴影层需要和内容分离，否则 sticky 单元格在滚动、
 * 选中和 hover 状态叠加时容易出现背景穿透或阴影被内容遮挡。
 */
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
        className='pointer-events-none absolute inset-0 transition-colors'
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

/** 列虚拟化单元格需要显式锁定宽度，不能再依赖 colgroup。 */
function getColumnVirtualCellWidthStyle(size: number): React.CSSProperties {
  return {
    width: size,
    minWidth: size,
    maxWidth: size
  };
}

export function DataTableBody<TData>({
  table,
  enableZebraStriping,
  emptyMessage,
  status,
  virtualization,
  columnVirtualWindow,
  columnDragMotionById,
  isColumnDragging,
  useTransformFreeVirtualRows = false,
  scrollViewportRef,
  headerRowRef,
  onRowClick,
  expandedRowKey,
  getExpandRowKey
}: DataTableBodyProps<TData>) {
  const prevKeyRef = useRef('');
  // 运行时异常时关闭虚拟化，回退到普通 tbody，保证数据仍可见。
  const [runtimeFallback, setRuntimeFallback] = useState(false);
  // 从真实表头测得的列宽是虚拟 td 的唯一宽度来源；虚拟 td 已脱离表格流。
  const [columnWidths, setColumnWidths] = useState<ReadonlyMap<string, number>>(() => new Map());

  const rows = table.getRowModel().rows;
  const { getCellSelectionProps } = useDataTableCellSelection<TData>({
    rows,
    columns: table.getVisibleLeafColumns(),
    scrollViewportRef,
    shouldIgnoreTarget: shouldIgnoreRowExpandTarget
  });
  // 行数达到阈值、环境支持并且没有运行时回退时才启用行虚拟化。
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

  // 测量真实表头宽度。
  // 对每个 <th> 绑定 ResizeObserver 可以覆盖列宽拖拽、窗口尺寸变化和列显隐，
  // 因此这里不需要额外依赖 columnSizing state。
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
      // 行展开只响应空白区域/普通单元格点击，避免和行操作、链接、输入控件抢事件。
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
      // 可展开行提供键盘 Enter/Space 触发，保持鼠标点击和键盘访问一致。
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
  const rowClassName = cn(onRowClick && 'cursor-pointer');

  const getExpandableRowTabIndex = useCallback(
    (row: Row<TData>) => (onRowClick && getExpandRowKey?.(row.original) ? 0 : undefined),
    [getExpandRowKey, onRowClick]
  );

  // 分页、排序、筛选变化后回到顶部；useLayoutEffect 保证在浏览器绘制前完成滚动复位。
  useLayoutEffect(() => {
    const key = `${pagination.pageIndex}-${pagination.pageSize}-${JSON.stringify(sorting)}-${JSON.stringify(columnFilters)}`;
    if (prevKeyRef.current && prevKeyRef.current !== key) {
      rowVirtualizer.scrollToIndex(0, { behavior: 'auto' });
    }
    prevKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageIndex, pagination.pageSize, sorting, columnFilters]);

  // KeepAlive 隐藏保护：当 viewport 被隐藏到 0x0 时暂停测量，重新可见后强制 measure。
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

  // 首次进入虚拟渲染时记录事件，方便测试和运行时诊断。
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
      // leafIndex 指向完整可见列数组，列虚拟化时只能渲染窗口内对应的 cell。
      const cell = row.getVisibleCells()[item.leafIndex] as Cell<TData, unknown> | undefined;
      if (!cell) return null;
      const pinningStyles = getBodyCellPinningStyles(cell);
      const columnDragMotion = resolveDataTableColumnDragCellMotion(
        columnDragMotionById,
        item.columnId,
        isColumnDragging
      );

      return (
        <TableCell
          key={cell.id}
          data-column-id={item.columnId}
          data-column-leaf-index={item.leafIndex}
          data-column-center-index={item.centerIndex >= 0 ? item.centerIndex : undefined}
          data-column-drag-motion={columnDragMotion ? 'true' : undefined}
          className={DATA_TABLE_BODY_CELL_CLASS_NAME}
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
            ...getColumnVirtualCellWidthStyle(item.size),
            ...columnDragMotion?.cellStyle
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
    [columnDragMotionById, getCellSelectionProps, isColumnDragging]
  );
  const renderColumnVirtualCells = useCallback(
    (row: Row<TData>, isVirtualRow: boolean) => {
      if (!columnVirtualWindow?.enabled) {
        return null;
      }

      return (
        <>
          {/* 固定列始终渲染；只有中间滚动区按虚拟窗口裁剪。 */}
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
    // 状态行（空、错误、引导等）放在 tbody 中，保持表格语义和 colSpan。
    return <DataTableStatus status={status} colSpan={table.getAllColumns().length} />;
  }

  if (!rows.length) {
    // 没有状态配置时使用基础空态，避免调用方必须为每张表写 empty state。
    return (
      <TableBody data-component='data-table-body'>
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
      // 虚拟行使用绝对定位撑开 tbody，总高度由 virtualizer 计算。
      const virtualItems = rowVirtualizer.getVirtualItems();
      const totalSize = rowVirtualizer.getTotalSize();
      const firstIndex = virtualItems[0]?.index ?? 0;
      const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;

      return (
        <TableBody
          data-component='data-table-body'
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
                data-row-index={virtualRow.index}
                data-striped={
                  enableZebraStriping && virtualRow.index % 2 === 1 ? 'true' : undefined
                }
                data-expanded={
                  expandedRowKey && getExpandRowKey?.(row.original) === expandedRowKey
                    ? 'true'
                    : undefined
                }
                aria-rowindex={virtualRow.index + 2}
                aria-selected={row.getIsSelected() ? true : undefined}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={rowClassName}
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
                  : row.getVisibleCells().map((cell) => {
                      const measured = columnWidths.get(cell.column.id);
                      const thWidth =
                        measured ??
                        (headerRowRef.current
                          ? getHeaderWidth(headerRowRef.current, cell.column.id)
                          : undefined);
                      const pinningStyles = getBodyCellPinningStyles(cell);
                      const columnDragMotion = resolveDataTableColumnDragCellMotion(
                        columnDragMotionById,
                        cell.column.id,
                        isColumnDragging
                      );
                      return (
                        <TableCell
                          key={cell.id}
                          data-column-id={cell.column.id}
                          data-column-drag-motion={columnDragMotion ? 'true' : undefined}
                          className={DATA_TABLE_BODY_CELL_CLASS_NAME}
                          {...getCellSelectionProps(cell)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '100%',
                            ...pinningStyles,
                            // 真实表头宽度优先于固定列配置宽度。
                            // 回退链路：测量宽度 → fixed 样式宽度 → column 默认宽度。
                            width:
                              thWidth ??
                              (pinningStyles.width as number | undefined) ??
                              cell.column.getSize(),
                            ...columnDragMotion?.cellStyle
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
      // react-virtual 在极端布局/浏览器场景可能抛错；这里回退普通渲染并通知调用方。
      setRuntimeFallback(true);
      emitDataTableVirtualEvent({ event: 'runtime-error' });
      virtualization?.onVirtualizationFallback?.('runtime-error');
    }
  }

  return (
    // 普通渲染路径仍支持列虚拟化；此时行不脱离表格流，只裁剪中间列窗口。
    <TableBody
      data-component='data-table-body'
      data-column-virtual-enabled={columnVirtualWindow?.enabled ? 'true' : undefined}
      data-column-virtual-count={
        columnVirtualWindow?.enabled ? columnVirtualWindow.items.length : undefined
      }
    >
      {rows.map((row, index) => (
        <TableRow
          key={row.id}
          data-row-index={index}
          data-striped={enableZebraStriping && index % 2 === 1 ? 'true' : undefined}
          data-expanded={
            expandedRowKey && getExpandRowKey?.(row.original) === expandedRowKey
              ? 'true'
              : undefined
          }
          data-state={row.getIsSelected() ? 'selected' : undefined}
          aria-selected={row.getIsSelected() ? true : undefined}
          className={rowClassName}
          onClick={(event) => handleRowClick(event, row)}
          onKeyDown={(event) => handleRowKeyDown(event, row)}
          tabIndex={getExpandableRowTabIndex(row)}
        >
          {columnVirtualWindow?.enabled
            ? renderColumnVirtualCells(row, false)
            : row.getVisibleCells().map((cell) => {
                const columnDragMotion = resolveDataTableColumnDragCellMotion(
                  columnDragMotionById,
                  cell.column.id,
                  isColumnDragging
                );

                return (
                  <TableCell
                    key={cell.id}
                    data-column-id={cell.column.id}
                    data-column-drag-motion={columnDragMotion ? 'true' : undefined}
                    className={DATA_TABLE_BODY_CELL_CLASS_NAME}
                    {...getCellSelectionProps(cell)}
                    style={{
                      ...getBodyCellPinningStyles(cell),
                      ...columnDragMotion?.cellStyle
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
      ))}
    </TableBody>
  );
}
