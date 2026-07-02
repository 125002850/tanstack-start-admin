import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { type Column, type Table as TanstackTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

import {
  DataTablePagination,
  type DataTablePaginationLabels
} from '@/components/ui/table/data-table-pagination';
import { Table } from '@/components/ui/table';
import { Icons } from '@/components/icons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTableBody } from '@/components/ui/table/data-table-body';
import { DataTableCellTooltipProvider } from '@/components/ui/table/data-table-cell-tooltip';
import { Separator } from '@/components/ui/separator';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { DataTableColGroup } from '@/components/ui/table/data-table-colgroup';
import {
  DataTableHeader,
  DataTableHeaderDragOverlay,
  getCanReorderColumn
} from '@/components/ui/table/data-table-header';
import type {
  DataTableResolvedVirtualizationOptions,
  DataTableColumnRenderItem,
  DataTableColumnVirtualWindow,
  DataTableVirtualizationProp,
  ExpandConfigEdge
} from '@/types/data-table';
import {
  DATA_TABLE_VIRTUAL_PRESET,
  resolveDataTableVirtualizationOptions
} from '@/config/data-table';
import {
  DataTableActionsBar,
  type DataTableAction
} from '@/components/ui/table/data-table-actions-bar';
import {
  DataTableExpandPanel,
  getAvailableExpandTabs
} from '@/components/ui/table/data-table-expand-panel';
import { DataTableExpandResizeHandle } from '@/components/ui/table/data-table-expand-trigger';
import {
  DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING,
  DATA_TABLE_EXPAND_KEYBOARD_STEP_PX,
  resolveExpandSplitLayout
} from '@/lib/data-table-expand-split';
import {
  DataTableStatus,
  type DataTableStatusConfig,
  type DataTableStatusFactory
} from '@/components/ui/table/data-table-status';
import { getSelectedPageRowCount } from '@/lib/data-table';
import { emitDataTableVirtualEvent } from '@/components/ui/table/data-table-virtual-events';
import { moveColumnOrder } from '@/lib/data-table-column-order-storage';

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>;
  tableActions?: DataTableAction<TData>[];
  actionBar?: React.ReactNode;
  getSelectedRows?: () => TData[];
  selectedRowCount?: number;
  scrollTargetId?: string;
  emptyMessage?: React.ReactNode;
  statusTotalCount?: number;
  getStatusConfig?: DataTableStatusFactory;
  statusDeps?: unknown[];
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  paginationLabels?: DataTablePaginationLabels;
  virtualization?: DataTableVirtualizationProp;
  expandConfig?: ExpandConfigEdge<TData>;
  expandedRow?: TData | null;
  expandedRowKey?: string | null;
  onExpandedRowKeyChange?: (rowKey: string | null) => void;
  expandPanelId?: string | null;
}

const FALLBACK_EXPAND_HOST_HEIGHT = 800;
const DEFAULT_COLUMN_SIZE = 150;
const COLUMN_ORDER_LONG_PRESS_DELAY_MS = 180;
const COLUMN_ORDER_LONG_PRESS_TOLERANCE_PX = 8;
const COLUMN_ORDER_LONG_PRESS_TOUCH_TOLERANCE_PX = 12;

function requestAnimationFrameSafe(callback: FrameRequestCallback) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(performance.now()), 0) as unknown as number;
}

function cancelAnimationFrameSafe(frameId: number) {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(frameId);
    return;
  }

  clearTimeout(frameId);
}

function isSafariBrowser() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor;

  return (
    /Safari/i.test(userAgent) &&
    /Apple/i.test(vendor) &&
    !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(userAgent)
  );
}

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

function createColumnRenderItem<TData>({
  column,
  leafIndex,
  centerIndex,
  size
}: {
  column: Column<TData>;
  leafIndex: number;
  centerIndex: number;
  size: number;
}): DataTableColumnRenderItem<TData> {
  return {
    column,
    columnId: column.id,
    leafIndex,
    centerIndex,
    size
  };
}

function resolveColumnVirtualizationFallbackReason<TData>({
  table,
  shouldAttemptColumnVirtualization
}: {
  table: TanstackTable<TData>;
  shouldAttemptColumnVirtualization: boolean;
}) {
  if (!shouldAttemptColumnVirtualization) {
    return undefined;
  }

  const headerGroups = table.getHeaderGroups();
  if (headerGroups.length > 1) {
    return 'grouped-header' as const;
  }

  if (headerGroups.some((group) => group.headers.some((header) => header.colSpan > 1))) {
    return 'header-colspan' as const;
  }

  return undefined;
}

export function DataTable<TData>({
  table,
  tableActions,
  actionBar,
  children,
  getSelectedRows,
  selectedRowCount,
  scrollTargetId,
  emptyMessage = '暂无数据',
  statusTotalCount,
  getStatusConfig,
  statusDeps,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
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
  const dragStateRef = React.useRef<{
    startY: number;
    startTopPx: number;
    minTopPx: number;
    maxTopPx: number;
    topPanel: HTMLDivElement;
  } | null>(null);
  const paginationRef = React.useRef<HTMLDivElement>(null);
  const [requestedSplitTopPx, setRequestedSplitTopPx] = React.useState<number | null>(null);
  const [activeExpandTab, setActiveExpandTab] = React.useState<string | null>(null);
  const [expandHostHeight, setExpandHostHeight] = React.useState(FALLBACK_EXPAND_HOST_HEIGHT);
  const [expandOverheadPx, setExpandOverheadPx] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const lastVirtualizationGateReasonRef = React.useRef<string | null>(null);
  const lastColumnVirtualizationFallbackReasonRef = React.useRef<string | null>(null);
  const columnVirtualizationEnabledEmittedRef = React.useRef(false);
  const suppressHeaderClickRef = React.useRef(false);
  const suppressHeaderClickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeColumnDrag, setActiveColumnDrag] = React.useState<{
    columnId: string;
    width: number | null;
  } | null>(null);
  const columnOrderSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: COLUMN_ORDER_LONG_PRESS_DELAY_MS,
        tolerance: COLUMN_ORDER_LONG_PRESS_TOLERANCE_PX
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: COLUMN_ORDER_LONG_PRESS_DELAY_MS,
        tolerance: COLUMN_ORDER_LONG_PRESS_TOUCH_TOLERANCE_PX
      }
    })
  );

  const statusEffectRef = React.useRef(getStatusConfig);
  statusEffectRef.current = getStatusConfig;

  React.useEffect(() => {
    return () => {
      if (suppressHeaderClickTimerRef.current !== null) {
        clearTimeout(suppressHeaderClickTimerRef.current);
      }
    };
  }, []);

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
      hasFilters,
      isLoading
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTotalCount, isLoading, table, ...(statusDeps ?? [])]);

  const virtualizationResolution = React.useMemo(
    () => resolveDataTableVirtualizationOptions(virtualization),
    [virtualization]
  );
  const virtConfig: DataTableResolvedVirtualizationOptions | undefined =
    virtualizationResolution.value;

  React.useEffect(() => {
    const reason = virtualizationResolution.gateReason;

    if (!reason) {
      lastVirtualizationGateReasonRef.current = null;
      return;
    }

    if (lastVirtualizationGateReasonRef.current === reason) {
      return;
    }

    lastVirtualizationGateReasonRef.current = reason;
    emitDataTableVirtualEvent({ event: reason });
    virtualizationResolution.onVirtualizationFallback?.(reason);
  }, [virtualizationResolution]);

  const shouldVirtualize =
    virtConfig?.enabled === true &&
    table.getRowModel().rows.length >=
      (virtConfig.rowCountThreshold ?? DATA_TABLE_VIRTUAL_PRESET.rowCountThreshold);
  const resolvedTableWidth = table.getTotalSize();
  const leftVisibleLeafColumns = table.getLeftVisibleLeafColumns();
  const centerVisibleLeafColumns = table.getCenterVisibleLeafColumns();
  const rightVisibleLeafColumns = table.getRightVisibleLeafColumns();
  const orderedLeafColumns = [
    ...leftVisibleLeafColumns,
    ...centerVisibleLeafColumns,
    ...rightVisibleLeafColumns
  ];
  const leafIndexByColumnId = new Map(
    orderedLeafColumns.map((column, index) => [column.id, index])
  );
  const columnVirtualizationConfig = virtConfig?.column;
  const shouldAttemptColumnVirtualization =
    typeof window !== 'undefined' &&
    columnVirtualizationConfig?.enabled === true &&
    centerVisibleLeafColumns.length >=
      (columnVirtualizationConfig.columnCountThreshold ??
        DATA_TABLE_VIRTUAL_PRESET.columnCountThreshold);
  const columnVirtualizationFallbackReason = resolveColumnVirtualizationFallbackReason({
    table,
    shouldAttemptColumnVirtualization
  });
  const shouldVirtualizeColumns =
    shouldAttemptColumnVirtualization && !columnVirtualizationFallbackReason;
  const horizontalColumnVirtualizer = useVirtualizer({
    count: centerVisibleLeafColumns.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize: (index) => centerVisibleLeafColumns[index]?.getSize() ?? DEFAULT_COLUMN_SIZE,
    horizontal: true,
    overscan: columnVirtualizationConfig?.overscan ?? DATA_TABLE_VIRTUAL_PRESET.columnOverscan,
    enabled: shouldVirtualizeColumns
  });
  const columnVirtualItems = shouldVirtualizeColumns
    ? horizontalColumnVirtualizer.getVirtualItems()
    : [];
  const leftColumnRenderItems = leftVisibleLeafColumns.map((column) =>
    createColumnRenderItem({
      column,
      leafIndex: leafIndexByColumnId.get(column.id) ?? 0,
      centerIndex: -1,
      size: column.getSize()
    })
  );
  const rightColumnRenderItems = rightVisibleLeafColumns.map((column) =>
    createColumnRenderItem({
      column,
      leafIndex: leafIndexByColumnId.get(column.id) ?? 0,
      centerIndex: -1,
      size: column.getSize()
    })
  );
  const centerColumnRenderItems = columnVirtualItems.flatMap((virtualColumn) => {
    const column = centerVisibleLeafColumns[virtualColumn.index];
    if (!column) return [];

    return [
      createColumnRenderItem({
        column,
        leafIndex: leafIndexByColumnId.get(column.id) ?? 0,
        centerIndex: virtualColumn.index,
        size: virtualColumn.size
      })
    ];
  });
  const virtualPaddingLeft = columnVirtualItems[0]?.start ?? 0;
  const virtualPaddingRight = shouldVirtualizeColumns
    ? Math.max(
        horizontalColumnVirtualizer.getTotalSize() - (columnVirtualItems.at(-1)?.end ?? 0),
        0
      )
    : 0;
  const columnVirtualWindow: DataTableColumnVirtualWindow<TData> = {
    enabled: shouldVirtualizeColumns,
    items: centerColumnRenderItems,
    leftItems: leftColumnRenderItems,
    rightItems: rightColumnRenderItems,
    virtualPaddingLeft,
    virtualPaddingRight,
    virtualTotalSize: horizontalColumnVirtualizer.getTotalSize()
  };
  const hasPinnedColumns = leftVisibleLeafColumns.length > 0 || rightVisibleLeafColumns.length > 0;
  const useTransformFreeVirtualRows =
    shouldVirtualize && shouldVirtualizeColumns && hasPinnedColumns && isSafariBrowser();
  const tableState = table.getState();
  const columnSizingSignature = Object.entries(tableState.columnSizing ?? {})
    .map(([key, value]) => `${key}:${value}`)
    .toSorted()
    .join('|');
  const columnVisibilitySignature = Object.entries(tableState.columnVisibility ?? {})
    .map(([key, value]) => `${key}:${value}`)
    .toSorted()
    .join('|');
  const centerColumnSizeSignature = centerVisibleLeafColumns
    .map((column) => `${column.id}:${column.getSize()}`)
    .join('|');
  const isFlatLeafHeader = table.getHeaderGroups().length === 1;
  const sortableColumnIds = React.useMemo(() => {
    if (!isFlatLeafHeader) return [];

    const draggableColumnIds = centerVisibleLeafColumns
      .filter(getCanReorderColumn)
      .map((column) => column.id);

    return draggableColumnIds.length > 1 ? draggableColumnIds : [];
  }, [centerVisibleLeafColumns, isFlatLeafHeader]);
  const draggableColumnIdSet = React.useMemo(() => new Set(sortableColumnIds), [sortableColumnIds]);
  const activeDragHeader = activeColumnDrag?.columnId
    ? table.getFlatHeaders().find((header) => header.column.id === activeColumnDrag.columnId)
    : undefined;

  React.useEffect(() => {
    if (!shouldVirtualizeColumns || columnVirtualizationEnabledEmittedRef.current) {
      return;
    }

    columnVirtualizationEnabledEmittedRef.current = true;
    emitDataTableVirtualEvent({
      event: 'columns-enabled',
      count: centerVisibleLeafColumns.length
    });
  }, [centerVisibleLeafColumns.length, shouldVirtualizeColumns]);

  React.useLayoutEffect(() => {
    if (!shouldVirtualizeColumns) {
      return;
    }

    const frameId = requestAnimationFrameSafe(() => {
      horizontalColumnVirtualizer.measure();
    });

    return () => cancelAnimationFrameSafe(frameId);
  }, [
    centerColumnSizeSignature,
    columnSizingSignature,
    columnVisibilitySignature,
    horizontalColumnVirtualizer,
    shouldVirtualizeColumns,
    tableState.columnSizingInfo.isResizingColumn
  ]);

  React.useEffect(() => {
    if (!columnVirtualizationFallbackReason) {
      lastColumnVirtualizationFallbackReasonRef.current = null;
      return;
    }

    if (lastColumnVirtualizationFallbackReasonRef.current === columnVirtualizationFallbackReason) {
      return;
    }

    lastColumnVirtualizationFallbackReasonRef.current = columnVirtualizationFallbackReason;
    emitDataTableVirtualEvent({
      event: 'columns-fallback',
      reason: columnVirtualizationFallbackReason
    });
    virtualizationResolution.onVirtualizationFallback?.(columnVirtualizationFallbackReason);
  }, [columnVirtualizationFallbackReason, virtualizationResolution]);

  // 仅相邻的非固定列之间显示分隔符（固定列和最后一列不显示）
  const centerColumnIds = new Set(centerVisibleLeafColumns.map((c) => c.id));
  const separatorColumnIds = new Set<string>();
  const orderedColumnIds = orderedLeafColumns.map((c) => c.id);
  for (let i = 0; i < orderedColumnIds.length - 1; i++) {
    if (centerColumnIds.has(orderedColumnIds[i]) && centerColumnIds.has(orderedColumnIds[i + 1])) {
      separatorColumnIds.add(orderedColumnIds[i]);
    }
  }

  const ariaRowCount = shouldVirtualize ? table.getRowModel().rows.length + 1 : undefined;
  const resolvedTableActions = React.useMemo(() => {
    if (!onRefresh) return tableActions;

    const refreshAction: DataTableAction<TData> = {
      label: '刷新列表',
      icon: <Icons.chevronsDown className='size-3.5' />,
      disabled: isRefreshing,
      callback: () => void onRefresh()
    };

    return tableActions ? [refreshAction, ...tableActions] : [refreshAction];
  }, [onRefresh, isRefreshing, tableActions]);
  const hasViewOptions = table
    .getAllColumns()
    .some((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide());
  const pageRows = table.getRowModel().rows;
  const resolvedSelectedRowCount =
    selectedRowCount ??
    (getSelectedRows ? getSelectedRows().length : getSelectedPageRowCount(table));
  const resolvedSelectedTotalRowCount =
    selectedRowCount !== undefined ? statusTotalCount : pageRows.length;
  const isExpanded = !!(expandConfig && expandedRow && expandPanelId);
  const expandTableSizing = expandConfig?.tableSizing ?? DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING;
  const expandSplitLayout = React.useMemo(
    () =>
      isExpanded
        ? resolveExpandSplitLayout({
            hostHeight: expandHostHeight,
            requestedTopPx: requestedSplitTopPx,
            overheadPx: expandOverheadPx,
            initialTopPx: expandTableSizing.initialHeight,
            minTopPx: expandTableSizing.minHeight,
            maxTopPx: expandTableSizing.maxHeight
          })
        : null,
    [expandHostHeight, expandOverheadPx, expandTableSizing, isExpanded, requestedSplitTopPx]
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
      const clampedTopPx = Math.min(
        Math.max(dragState.startTopPx + deltaY, dragState.minTopPx),
        dragState.maxTopPx
      );

      dragState.topPanel.style.flex = 'none';
      dragState.topPanel.style.height = `${clampedTopPx}px`;
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
        Math.min(Math.max(nextTopPx, expandSplitLayout.minTopPx), expandSplitLayout.maxTopPx)
      );
    },
    [expandSplitLayout]
  );

  const armSuppressHeaderClick = React.useCallback(() => {
    suppressHeaderClickRef.current = true;

    if (suppressHeaderClickTimerRef.current !== null) {
      clearTimeout(suppressHeaderClickTimerRef.current);
    }

    suppressHeaderClickTimerRef.current = setTimeout(() => {
      suppressHeaderClickRef.current = false;
      suppressHeaderClickTimerRef.current = null;
    }, 0);
  }, []);

  const handleHeaderClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (!suppressHeaderClickRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      suppressHeaderClickRef.current = false;

      if (suppressHeaderClickTimerRef.current !== null) {
        clearTimeout(suppressHeaderClickTimerRef.current);
        suppressHeaderClickTimerRef.current = null;
      }
    },
    []
  );

  const handleColumnDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const columnId = String(event.active.id);
      if (!draggableColumnIdSet.has(columnId)) return;

      const activeRect = event.active.rect.current.initial;
      setActiveColumnDrag({
        columnId,
        width: activeRect?.width ? Math.round(activeRect.width) : null
      });
      armSuppressHeaderClick();
    },
    [armSuppressHeaderClick, draggableColumnIdSet]
  );

  const handleColumnDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;

      setActiveColumnDrag(null);

      if (
        !overId ||
        activeId === overId ||
        !draggableColumnIdSet.has(activeId) ||
        !draggableColumnIdSet.has(overId)
      ) {
        return;
      }

      const currentColumnOrder = table.getAllLeafColumns().map((column) => column.id);
      const nextColumnOrder = moveColumnOrder(currentColumnOrder, activeId, overId);

      table.setColumnOrder(nextColumnOrder);
    },
    [draggableColumnIdSet, table]
  );

  const handleColumnDragCancel = React.useCallback(() => {
    setActiveColumnDrag(null);
  }, []);

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
        <DataTableCellTooltipProvider>
          <DndContext
            sensors={columnOrderSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragStart={handleColumnDragStart}
            onDragEnd={handleColumnDragEnd}
            onDragCancel={handleColumnDragCancel}
          >
            <SortableContext items={sortableColumnIds} strategy={horizontalListSortingStrategy}>
              <Table
                aria-rowcount={ariaRowCount}
                data-column-virtual-enabled={shouldVirtualizeColumns ? 'true' : undefined}
                data-column-virtual-count={
                  shouldVirtualizeColumns ? columnVirtualWindow.items.length : undefined
                }
                data-column-virtual-total-size={
                  shouldVirtualizeColumns ? columnVirtualWindow.virtualTotalSize : undefined
                }
                style={{ tableLayout: 'fixed', width: resolvedTableWidth }}
              >
                {shouldVirtualizeColumns ? null : (
                  <DataTableColGroup columns={orderedLeafColumns} />
                )}
                <DataTableHeader
                  table={table}
                  columnVirtualWindow={columnVirtualWindow}
                  shouldVirtualizeColumns={shouldVirtualizeColumns}
                  separatorColumnIds={separatorColumnIds}
                  draggableColumnIdSet={draggableColumnIdSet}
                  headerRowRef={headerRowRef}
                  onHeaderClickCapture={handleHeaderClickCapture}
                />
                <DataTableBody
                  table={table}
                  emptyMessage={emptyMessage}
                  status={resolvedStatus}
                  virtualization={virtConfig}
                  columnVirtualWindow={columnVirtualWindow}
                  useTransformFreeVirtualRows={useTransformFreeVirtualRows}
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
            </SortableContext>
            <DragOverlay>
              {activeDragHeader ? (
                <DataTableHeaderDragOverlay
                  header={activeDragHeader}
                  width={activeColumnDrag?.width ?? null}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </DataTableCellTooltipProvider>
      </ScrollArea>
    </div>
  );

  return (
    <div className='flex flex-1 flex-col space-y-3'>
      {resolvedStatus?.type === 'permission' ? (
        <DataTableStatus status={resolvedStatus} className='flex-1' />
      ) : (
        <>
          {(children || resolvedTableActions || hasViewOptions) && (
            <div className='flex flex-col'>
              {children && <div>{children}</div>}
              {children && (resolvedTableActions || hasViewOptions) && (
                <Separator className='my-2 ml-[calc(var(--page-container-padding-x,0rem)*-1)] data-[orientation=horizontal]:!w-[calc(100%+var(--page-container-padding-x,0rem)*2)]' />
              )}
              {(resolvedTableActions || hasViewOptions) && (
                <div className='flex items-center gap-2 px-1'>
                  {resolvedTableActions && (
                    <DataTableActionsBar
                      table={table}
                      actions={resolvedTableActions}
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
            <div ref={expandHostRef} className='flex flex-1 min-h-0 min-w-0 flex-col'>
              <div
                ref={topPanelRef}
                data-slot='data-table-expand-main'
                className='relative min-h-0'
                style={
                  expandSplitLayout.isConstrained
                    ? { flex: `0 0 ${expandSplitLayout.topPx}px` }
                    : { flex: '1 1 0%' }
                }
              >
                {tableViewport}
              </div>
              <div ref={paginationRef} className='flex flex-col gap-2.5'>
                <DataTablePagination
                  table={table}
                  labels={paginationLabels}
                  getSelectedRows={getSelectedRows}
                  selectedRowCount={resolvedSelectedRowCount}
                  selectedTotalRowCount={resolvedSelectedTotalRowCount}
                  totalRowCount={statusTotalCount}
                />
                {actionBar && resolvedSelectedRowCount > 0 && actionBar}
              </div>
              <DataTableExpandResizeHandle
                min={expandSplitLayout.minTopPx}
                max={expandSplitLayout.maxTopPx}
                value={expandSplitLayout.topPx}
                disabled={!expandSplitLayout.dragEnabled}
                dragging={isDragging}
                onKeyDown={handleSplitKeyDown}
                onPointerDown={(event) => {
                  if (!expandSplitLayout.dragEnabled) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  const topEl = topPanelRef.current;
                  if (!topEl) return;

                  setIsDragging(true);
                  dragStateRef.current = {
                    startY: event.clientY,
                    startTopPx: topEl.getBoundingClientRect().height,
                    minTopPx: expandSplitLayout.minTopPx,
                    maxTopPx: expandSplitLayout.maxTopPx,
                    topPanel: topEl
                  };
                }}
              />
              <div
                data-slot='data-table-expand-panel-host'
                className='min-h-0 min-w-0 shrink-0'
                style={{
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
                  selectedRowCount={resolvedSelectedRowCount}
                  selectedTotalRowCount={resolvedSelectedTotalRowCount}
                  totalRowCount={statusTotalCount}
                />
                {actionBar && resolvedSelectedRowCount > 0 && actionBar}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
