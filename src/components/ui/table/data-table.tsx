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
  clampExpandSplitTop,
  resolveExpandSplitLayout
} from '@/lib/data-table-expand-split';

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>;
  tableActions?: DataTableAction<TData>[];
  actionBar?: React.ReactNode;
  scrollTargetId?: string;
  emptyMessage?: string;
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
  scrollTargetId,
  emptyMessage = '暂无数据',
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
  const dragStateRef = React.useRef<{ startY: number; startTopPx: number } | null>(null);
  const [requestedSplitTopPx, setRequestedSplitTopPx] = React.useState<number | null>(null);
  const [activeExpandTab, setActiveExpandTab] = React.useState<string | null>(null);
  const [expandHostHeight, setExpandHostHeight] = React.useState(FALLBACK_EXPAND_HOST_HEIGHT);

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
  const isExpanded = !!(expandConfig && expandedRow && expandPanelId);
  const expandSplitLayout = React.useMemo(
    () =>
      isExpanded
        ? resolveExpandSplitLayout({
            hostHeight: expandHostHeight,
            requestedTopPx: requestedSplitTopPx
          })
        : null,
    [expandHostHeight, isExpanded, requestedSplitTopPx]
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
    if (!expandSplitLayout || !dragStateRef.current) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const deltaY = event.clientY - dragState.startY;
      setRequestedSplitTopPx(
        clampExpandSplitTop({
          hostHeight: expandHostHeight,
          topPx: dragState.startTopPx + deltaY
        })
      );
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [expandHostHeight, expandSplitLayout]);

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
      className={
        isExpanded ? 'flex h-full overflow-hidden rounded-lg' : 'absolute inset-0 flex overflow-hidden rounded-lg'
      }
    >
      <ScrollArea
        className='h-full'
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
      {(children || tableActions || hasViewOptions) && (
        <div className='flex flex-col'>
          {children && <div>{children}</div>}
          {children && (tableActions || hasViewOptions) && (
            <Separator className='my-2 ml-[calc(var(--page-container-padding-x,0rem)*-1)] data-[orientation=horizontal]:!w-[calc(100%+var(--page-container-padding-x,0rem)*2)]' />
          )}
          {(tableActions || hasViewOptions) && (
            <div className='flex items-center gap-2 px-1'>
              {tableActions && <DataTableActionsBar table={table} actions={tableActions} />}
              {hasViewOptions && (
                <DataTableViewOptions table={table} iconOnly className='ml-auto' />
              )}
            </div>
          )}
        </div>
      )}
      {isExpanded && expandSplitLayout && activeExpandTab && expandConfig && expandedRow && expandPanelId ? (
        <div ref={expandHostRef} className='flex flex-1 min-h-0 flex-col'>
          <div className='relative min-h-0' style={{ height: `${expandSplitLayout.topPx}px` }}>
            {tableViewport}
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
            className='bg-border hover:bg-border/80 focus-visible:ring-ring/50 h-2 shrink-0 cursor-row-resize outline-none transition-colors focus-visible:ring-[3px]'
            onKeyDown={handleSplitKeyDown}
            onPointerDown={(event) => {
              if (!expandSplitLayout.dragEnabled) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              dragStateRef.current = {
                startY: event.clientY,
                startTopPx: expandSplitLayout.topPx
              };
            }}
          />
          <div className='min-h-0' style={{ height: `${expandSplitLayout.bottomPx}px` }}>
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
        <div className='relative flex flex-1 min-h-0'>{tableViewport}</div>
      )}
      <div className='flex flex-col gap-2.5'>
        <DataTablePagination table={table} labels={paginationLabels} />
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}
