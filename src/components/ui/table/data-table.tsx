import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import * as React from 'react';

import {
  DataTablePagination,
  type DataTablePaginationLabels
} from '@/components/ui/table/data-table-pagination';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCommonPinningStyles } from '@/lib/data-table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTableBody } from '@/components/ui/table/data-table-body';
import { Separator } from '@/components/ui/separator';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { DataTableColumnResizeHandle } from './data-table-column-resize-handle';
import type { DataTableVirtualizationOptions, ExpandConfigEdge } from '@/types/data-table';
import { DATA_TABLE_VIRTUAL_PRESET } from '@/config/data-table';
import {
  DataTableActionsBar,
  type DataTableAction
} from '@/components/ui/table/data-table-actions-bar';
import {
  DataTableExpandPanel,
  getAvailableExpandTabs
} from '@/components/ui/table/data-table-expand-panel';
import {
  DATA_TABLE_EXPAND_KEYBOARD_STEP_PX,
  DATA_TABLE_EXPAND_SPLIT_HANDLE_PX,
  clampExpandSplitTop,
  resolveExpandSplitLayout
} from '@/lib/data-table-expand-split';
import {
  DataTableStatus,
  type DataTableStatusConfig,
  type DataTableStatusFactory
} from '@/components/ui/table/data-table-status';

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>;
  tableActions?: DataTableAction<TData>[];
  actionBar?: React.ReactNode;
  getSelectedRows?: () => TData[];
  scrollTargetId?: string;
  emptyMessage?: React.ReactNode;
  statusTotalCount?: number;
  getStatusConfig?: DataTableStatusFactory;
  statusDeps?: unknown[];
  paginationLabels?: DataTablePaginationLabels;
  virtualization?: DataTableVirtualizationOptions | boolean;
  expandConfig?: ExpandConfigEdge<TData>;
  expandedRow?: TData | null;
  expandedRowKey?: string | null;
  onExpandedRowKeyChange?: (rowKey: string | null) => void;
  expandPanelId?: string | null;
}

const FALLBACK_EXPAND_HOST_HEIGHT = 800;

function resolveExpandActiveTabId<TData>(
  expandConfig: ExpandConfigEdge<TData>,
  row: TData,
  activeTab: string | null
) {
  const availableTabs = getAvailableExpandTabs(expandConfig, row);

  if (availableTabs.length === 0) {
    return null;
  }

  if (activeTab && availableTabs.some((tab) => tab.id === activeTab)) {
    return activeTab;
  }

  if (expandConfig.defaultTab && availableTabs.some((tab) => tab.id === expandConfig.defaultTab)) {
    return expandConfig.defaultTab;
  }

  return availableTabs[0]?.id ?? null;
}

export function DataTable<TData>({
  table,
  tableActions,
  actionBar,
  children,
  getSelectedRows,
  scrollTargetId,
  emptyMessage = '暂无数据',
  statusTotalCount,
  getStatusConfig,
  statusDeps,
  paginationLabels,
  virtualization,
  expandConfig,
  expandedRow,
  expandedRowKey,
  onExpandedRowKeyChange,
  expandPanelId
}: DataTableProps<TData>) {
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  const headerRowRef = React.useRef<HTMLTableRowElement>(null);
  const expandHostRef = React.useRef<HTMLDivElement>(null);
  const topPanelRef = React.useRef<HTMLDivElement>(null);
  const bottomPanelRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<{
    startY: number;
    startTopPx: number;
    effectiveHeight: number;
    topPanel: HTMLDivElement;
    bottomPanel: HTMLDivElement;
  } | null>(null);
  const paginationRef = React.useRef<HTMLDivElement>(null);
  const [requestedSplitTopPx, setRequestedSplitTopPx] = React.useState<number | null>(null);
  const [activeExpandTab, setActiveExpandTab] = React.useState<string | null>(null);
  const [expandHostHeight, setExpandHostHeight] = React.useState(FALLBACK_EXPAND_HOST_HEIGHT);
  const [expandOverheadPx, setExpandOverheadPx] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const statusEffectRef = React.useRef(getStatusConfig);
  statusEffectRef.current = getStatusConfig;

  const resolvedStatus = React.useMemo((): DataTableStatusConfig | undefined => {
    if (!statusEffectRef.current) return undefined;
    const rows = table.getRowModel().rows;
    const columnFilters = table.getState().columnFilters;
    const hasFilters = columnFilters.some((f) => {
      const v = f.value;
      if (v === '' || v === null || v === undefined) return false;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    });
    return statusEffectRef.current({
      rows,
      totalCount: statusTotalCount ?? 0,
      hasFilters
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTotalCount, table, ...(statusDeps ?? [])]);

  const virtConfig: DataTableVirtualizationOptions | undefined =
    virtualization === true
      ? { enabled: true }
      : virtualization === false || virtualization === undefined
        ? undefined
        : virtualization;

  const shouldVirtualize =
    virtConfig?.enabled === true &&
    table.getRowModel().rows.length >=
      (virtConfig.rowCountThreshold ?? DATA_TABLE_VIRTUAL_PRESET.rowCountThreshold);
  const resolvedTableWidth = table.getTotalSize();
  const orderedLeafColumns = [
    ...table.getLeftVisibleLeafColumns(),
    ...table.getCenterVisibleLeafColumns(),
    ...table.getRightVisibleLeafColumns()
  ];
  const colgroup = (
    <colgroup>
      {orderedLeafColumns.map((column) => (
        <col key={column.id} style={{ width: column.getSize() }} />
      ))}
    </colgroup>
  );

  const ariaRowCount = shouldVirtualize ? table.getRowModel().rows.length + 1 : undefined;
  const hasViewOptions = table
    .getAllColumns()
    .some((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide());
  const selectedRowCount = getSelectedRows
    ? getSelectedRows().length
    : table.getFilteredSelectedRowModel().rows.length;
  const isExpanded = !!(expandConfig && expandedRow && expandPanelId);
  const expandSplitLayout = React.useMemo(
    () =>
      isExpanded
        ? resolveExpandSplitLayout({
            hostHeight: expandHostHeight,
            requestedTopPx: requestedSplitTopPx,
            overheadPx: expandOverheadPx
          })
        : null,
    [expandHostHeight, expandOverheadPx, isExpanded, requestedSplitTopPx]
  );

  const getExpandRowKey = React.useCallback(
    (row: TData) => {
      if (!expandConfig) {
        return null;
      }

      const value = row[expandConfig.rowKey];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
    },
    [expandConfig]
  );

  React.useEffect(() => {
    if (!expandConfig || !expandedRow) {
      setActiveExpandTab(null);
      return;
    }

    setActiveExpandTab((current) => resolveExpandActiveTabId(expandConfig, expandedRow, current));
  }, [expandConfig, expandedRow, expandedRowKey]);

  React.useLayoutEffect(() => {
    if (!isExpanded) {
      return;
    }

    const hostElement = expandHostRef.current;
    if (!hostElement) {
      return;
    }

    const measure = () => {
      const nextHeight =
        Math.round(hostElement.getBoundingClientRect().height) ||
        hostElement.clientHeight ||
        FALLBACK_EXPAND_HOST_HEIGHT;

      setExpandHostHeight((current) => (current === nextHeight ? current : nextHeight));

      const paginationEl = paginationRef.current;
      if (paginationEl) {
        const paginationHeight = Math.round(paginationEl.getBoundingClientRect().height);
        setExpandOverheadPx((current) =>
          current === paginationHeight ? current : paginationHeight
        );
      }
    };

    measure();
    window.addEventListener('resize', measure);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(hostElement);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isExpanded]);

  React.useEffect(() => {
    if (!expandSplitLayout) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const deltaY = event.clientY - dragState.startY;
      const clampedTopPx = clampExpandSplitTop({
        hostHeight: dragState.effectiveHeight,
        topPx: dragState.startTopPx + deltaY
      });
      const bottomPx = Math.max(
        0,
        dragState.effectiveHeight - DATA_TABLE_EXPAND_SPLIT_HANDLE_PX - clampedTopPx
      );

      // Direct DOM update — instant, no React reconciliation
      dragState.topPanel.style.height = `${clampedTopPx}px`;
      dragState.bottomPanel.style.height = `${bottomPx}px`;
    };

    const handlePointerUp = () => {
      const dragState = dragStateRef.current;
      if (dragState) {
        // Commit final position to React state
        setRequestedSplitTopPx(parseInt(dragState.topPanel.style.height, 10));
      }
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [expandSplitLayout]);

  const handleExpandPanelClose = React.useCallback(() => {
    onExpandedRowKeyChange?.(null);
    setActiveExpandTab(null);
  }, [onExpandedRowKeyChange]);

  const handleSplitKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!expandSplitLayout || !expandSplitLayout.dragEnabled) {
        return;
      }

      let nextTopPx: number | null = null;

      switch (event.key) {
        case 'ArrowUp':
          nextTopPx = expandSplitLayout.topPx - DATA_TABLE_EXPAND_KEYBOARD_STEP_PX;
          break;
        case 'ArrowDown':
          nextTopPx = expandSplitLayout.topPx + DATA_TABLE_EXPAND_KEYBOARD_STEP_PX;
          break;
        case 'Home':
          nextTopPx = expandSplitLayout.minTopPx;
          break;
        case 'End':
          nextTopPx = expandSplitLayout.maxTopPx;
          break;
        default:
          break;
      }

      if (nextTopPx === null) {
        return;
      }

      event.preventDefault();
      setRequestedSplitTopPx(
        clampExpandSplitTop({
          hostHeight: expandHostHeight,
          topPx: nextTopPx
        })
      );
    },
    [expandHostHeight, expandSplitLayout]
  );

  const tableViewport = (
    <div
      data-table-resize-overlay-root
      className={isExpanded ? 'h-full rounded-lg' : 'absolute inset-0 rounded-lg'}
    >
      <ScrollArea
        className='h-full w-full'
        viewportRef={scrollViewportRef}
        viewportProps={
          scrollTargetId
            ? {
                'data-scroll-target-id': scrollTargetId
              }
            : undefined
        }
      >
        <Table
          aria-rowcount={ariaRowCount}
          style={{ tableLayout: 'fixed', width: resolvedTableWidth }}
        >
          {colgroup}
          <TableHeader className='bg-muted sticky top-0 z-10'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} ref={headerRowRef}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{
                      ...getCommonPinningStyles({ column: header.column }),
                      ...(header.column.getIsPinned() ? { background: 'var(--muted)' } : {})
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    <DataTableColumnResizeHandle header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            emptyMessage={emptyMessage}
            status={resolvedStatus}
            virtualization={virtConfig}
            scrollViewportRef={scrollViewportRef}
            headerRowRef={headerRowRef}
            onRowClick={
              expandConfig
                ? (rowKey) => {
                    if (rowKey === expandedRowKey) {
                      return;
                    }

                    onExpandedRowKeyChange?.(rowKey);
                  }
                : undefined
            }
            expandedRowKey={expandedRowKey}
            getExpandRowKey={expandConfig ? getExpandRowKey : undefined}
          />
        </Table>
      </ScrollArea>
    </div>
  );

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      {resolvedStatus?.type === 'onboarding' ? (
        <DataTableStatus status={resolvedStatus} className='flex-1' />
      ) : (
        <>
          {(children || tableActions || hasViewOptions) && (
            <div className='flex flex-col'>
              {children && <div>{children}</div>}
              {children && (tableActions || hasViewOptions) && (
                <Separator className='my-2 ml-[calc(var(--page-container-padding-x,0rem)*-1)] data-[orientation=horizontal]:!w-[calc(100%+var(--page-container-padding-x,0rem)*2)]' />
              )}
              {(tableActions || hasViewOptions) && (
                <div className='flex items-center gap-2 px-1'>
                  {tableActions && (
                    <DataTableActionsBar
                      table={table}
                      actions={tableActions}
                      getSelectedRows={getSelectedRows}
                    />
                  )}
                  {hasViewOptions && (
                    <DataTableViewOptions table={table} iconOnly className='ml-auto' />
                  )}
                </div>
              )}
            </div>
          )}
          {isExpanded &&
          expandSplitLayout &&
          activeExpandTab &&
          expandConfig &&
          expandedRow &&
          expandPanelId ? (
            <div ref={expandHostRef} className='flex flex-1 min-h-0 flex-col'>
              <div
                ref={topPanelRef}
                className='relative min-h-0'
                style={{ height: `${expandSplitLayout.topPx}px` }}
              >
                {tableViewport}
              </div>
              <div ref={paginationRef} className='flex flex-col gap-2.5'>
                <DataTablePagination
                  table={table}
                  labels={paginationLabels}
                  getSelectedRows={getSelectedRows}
                  totalRowCount={statusTotalCount}
                />
                {actionBar && selectedRowCount > 0 && actionBar}
              </div>
              <div
                role='separator'
                tabIndex={0}
                aria-orientation='horizontal'
                aria-valuemin={expandSplitLayout.minTopPx}
                aria-valuemax={expandSplitLayout.maxTopPx}
                aria-valuenow={expandSplitLayout.topPx}
                aria-disabled={expandSplitLayout.dragEnabled ? undefined : true}
                data-slot='data-table-expand-split-handle'
                className='group relative flex h-2 shrink-0 cursor-row-resize items-center justify-center outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]'
                onKeyDown={handleSplitKeyDown}
                onPointerDown={(event) => {
                  if (!expandSplitLayout.dragEnabled) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  const topEl = topPanelRef.current;
                  const bottomEl = bottomPanelRef.current;
                  if (!topEl || !bottomEl) return;

                  setIsDragging(true);
                  dragStateRef.current = {
                    startY: event.clientY,
                    startTopPx: expandSplitLayout.topPx,
                    effectiveHeight: expandHostHeight - expandOverheadPx,
                    topPanel: topEl,
                    bottomPanel: bottomEl
                  };
                }}
              >
                {/* Pill handle with grip dots — visible on hover, focus, and during active drag */}
                <span
                  className={
                    isDragging
                      ? 'inline-flex h-1.5 w-10 items-center justify-center rounded-full bg-border/40 opacity-100'
                      : 'inline-flex h-1.5 w-10 items-center justify-center rounded-full bg-border/0 opacity-0 transition-all duration-200 group-hover:bg-border/40 group-hover:opacity-100 group-focus-visible:bg-border/40 group-focus-visible:opacity-100'
                  }
                >
                  <span className='inline-flex gap-px'>
                    <span className='block h-0.5 w-0.5 rounded-full bg-muted-foreground/40' />
                    <span className='block h-0.5 w-0.5 rounded-full bg-muted-foreground/40' />
                    <span className='block h-0.5 w-0.5 rounded-full bg-muted-foreground/40' />
                  </span>
                </span>
              </div>
              <div
                ref={bottomPanelRef}
                className='min-h-0'
                style={{
                  height: `${expandSplitLayout.bottomPx}px`,
                  boxShadow: 'inset 0 6px 10px -6px hsl(var(--border))'
                }}
              >
                <DataTableExpandPanel
                  panelId={expandPanelId}
                  row={expandedRow}
                  expandConfig={expandConfig}
                  activeTab={activeExpandTab}
                  onActiveTabChange={setActiveExpandTab}
                  onClose={handleExpandPanelClose}
                />
              </div>
            </div>
          ) : (
            <>
              <div className='relative flex flex-1 min-h-[280px]'>{tableViewport}</div>
              <div className='flex flex-col gap-2.5'>
                <DataTablePagination
                  table={table}
                  labels={paginationLabels}
                  getSelectedRows={getSelectedRows}
                  totalRowCount={statusTotalCount}
                />
                {actionBar && selectedRowCount > 0 && actionBar}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
