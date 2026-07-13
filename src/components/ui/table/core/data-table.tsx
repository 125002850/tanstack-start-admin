import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { type Table as TanstackTable } from '@tanstack/react-table';
import * as React from 'react';

import {
  DataTablePagination,
  type DataTablePaginationLabels
} from '@/components/ui/table/core/data-table-pagination';
import { Table } from '@/components/ui/table';
import { Icons } from '@/components/icons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTableBody } from '@/components/ui/table/core/data-table-body';
import { DataTableCellTooltipProvider } from '@/components/ui/table/cells/data-table-cell-tooltip';
import { Separator } from '@/components/ui/separator';
import { DataTableViewOptions } from '@/components/ui/table/toolbar/data-table-view-options';
import { DataTableColGroup } from '@/components/ui/table/core/data-table-colgroup';
import {
  DATA_TABLE_HEADER_ROW_HEIGHT_PX,
  DataTableHeader,
  DataTableHeaderDragOverlay
} from '@/components/ui/table/core/data-table-header';
import type { DataTableVirtualizationProp, ExpandConfigEdge } from '@/types/data-table';
import {
  DataTableActionsBar,
  type DataTableAction
} from '@/components/ui/table/actions/data-table-actions-bar';
import { DataTableExpandPanel } from '@/components/ui/table/expand/data-table-expand-panel';
import { DataTableExpandResizeHandle } from '@/components/ui/table/expand/data-table-expand-trigger';
import {
  DataTableStatus,
  type DataTableStatusConfig,
  type DataTableStatusFactory
} from '@/components/ui/table/feedback/data-table-status';
import {
  DataTableSkeleton,
  type DataTableSkeletonProps
} from '@/components/ui/table/feedback/data-table-skeleton';
import { getSelectedPageRowCount } from '@/lib/data-table';
import { useDataTableColumnDnd } from '@/components/ui/table/dnd/use-data-table-column-dnd';
import { useDataTableExpandPanel } from '@/components/ui/table/expand/use-data-table-expand-panel';
import { useDataTableVirtualization } from '@/components/ui/table/virtualization/use-data-table-virtualization';

/**
 * DataTable 的主渲染组件。
 *
 * 该组件不负责请求数据，也不直接维护 TanStack Table 的业务状态；它消费外部传入的
 * table 实例和少量 UI 配置，把工具栏操作、列拖拽、虚拟滚动、固定列、分页、加载骨架
 * 与行展开面板组装成完整表格界面。
 */
const DATA_TABLE_SKELETON_MAX_COLUMN_COUNT = 10;
const DATA_TABLE_SKELETON_MAX_FILTER_COUNT = 8;
const DATA_TABLE_SCROLLBAR_SIZE_PX = 10;

/** 控制加载骨架的可选参数；列数和筛选数未传时会从 table 当前状态推导。 */
export type DataTableLoadingSkeletonConfig = Omit<
  DataTableSkeletonProps,
  'columnCount' | 'filterCount' | 'withViewOptions'
> & {
  columnCount?: number;
  filterCount?: number;
  withViewOptions?: boolean;
};

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
  /** @deprecated DataTable 现在会在每次 render 时基于 table state 自动重新计算状态。 */
  statusDeps?: unknown[];
  isLoading?: boolean;
  loadingSkeleton?: DataTableLoadingSkeletonConfig;
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

/** 把自动推导的骨架数量限制在合理范围，避免宽表/多筛选条件渲染过多占位元素。 */
function getBoundedPositiveCount(value: number, max: number) {
  return Math.max(1, Math.min(value, max));
}

/**
 * 根据真实表格状态推导骨架屏参数。
 *
 * - 可见列数决定骨架列数，但最多展示 10 列，保持加载态轻量。
 * - 可筛选列数决定工具栏占位数量，但最多展示 8 个。
 * - view options 和分页默认跟随真实表格能力，避免加载态和完成态布局跳动。
 */
function getDataTableLoadingSkeletonProps<TData>({
  table,
  hasViewOptions,
  loadingSkeleton
}: {
  table: TanstackTable<TData>;
  hasViewOptions: boolean;
  loadingSkeleton: DataTableLoadingSkeletonConfig;
}): DataTableSkeletonProps {
  const { columnCount, filterCount, withViewOptions, withPagination, ...skeletonProps } =
    loadingSkeleton;
  const inferredColumnCount = getBoundedPositiveCount(
    table.getVisibleLeafColumns().length,
    DATA_TABLE_SKELETON_MAX_COLUMN_COUNT
  );
  const inferredFilterCount = Math.min(
    table.getAllColumns().filter((column) => column.getCanFilter()).length,
    DATA_TABLE_SKELETON_MAX_FILTER_COUNT
  );

  return {
    ...skeletonProps,
    columnCount: columnCount ?? inferredColumnCount,
    filterCount: filterCount ?? inferredFilterCount,
    withViewOptions: withViewOptions ?? hasViewOptions,
    withPagination: withPagination ?? true
  };
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
  isLoading = false,
  loadingSkeleton,
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
  // ScrollArea 的 viewport 是行/列虚拟化共同依赖的滚动容器。
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  // 表头行用于表体虚拟行测量真实列宽，尤其在 fixed table layout 下避免宽度漂移。
  const headerRowRef = React.useRef<HTMLTableRowElement>(null);

  const rows = table.getRowModel().rows;
  const columnFilters = table.getState().columnFilters;
  // 只把有实际值的筛选计入状态判断；空字符串、空数组都视为未筛选。
  const hasFilters = columnFilters.some((filter) => {
    const value = filter.value;
    if (value === '' || value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  const resolvedStatus: DataTableStatusConfig | undefined = getStatusConfig?.({
    rows,
    totalCount: statusTotalCount ?? 0,
    hasFilters,
    isLoading
  });

  // 虚拟化 hook 同时返回行虚拟化配置、列虚拟窗口和 Safari 固定列兼容开关。
  const {
    ariaRowCount,
    centerVisibleLeafColumns,
    columnVirtualWindow,
    orderedLeafColumns,
    resolvedTableWidth,
    shouldVirtualizeColumns,
    useTransformFreeVirtualRows,
    virtConfig
  } = useDataTableVirtualization({
    table,
    virtualization,
    scrollViewportRef
  });
  // 固定列宽度用于定位横向滚动条，让滚动条不覆盖左/右固定列。
  const pinnedLeftWidth = table
    .getLeftVisibleLeafColumns()
    .reduce((total, column) => total + column.getSize(), 0);
  const pinnedRightWidth = table
    .getRightVisibleLeafColumns()
    .reduce((total, column) => total + column.getSize(), 0);
  const pinnedHeaderHeight = table.getHeaderGroups().length * DATA_TABLE_HEADER_ROW_HEIGHT_PX;
  const isFlatLeafHeader = table.getHeaderGroups().length === 1;
  // 只有单层叶子表头才启用表头列拖拽，分组表头会由 header 结构保护而回退为静态表头。
  const {
    activeColumnDrag,
    activeDragHeader,
    columnOrderSensors,
    draggableColumnIdSet,
    handleColumnDragCancel,
    handleColumnDragEnd,
    handleColumnDragStart,
    handleHeaderClickCapture,
    sortableColumnIds
  } = useDataTableColumnDnd({
    table,
    centerVisibleLeafColumns,
    isFlatLeafHeader
  });

  // 仅相邻的非固定列之间显示分隔符（固定列和最后一列不显示）
  const centerColumnIds = new Set(centerVisibleLeafColumns.map((c) => c.id));
  const separatorColumnIds = new Set<string>();
  const orderedColumnIds = orderedLeafColumns.map((c) => c.id);
  for (let i = 0; i < orderedColumnIds.length - 1; i++) {
    if (centerColumnIds.has(orderedColumnIds[i]) && centerColumnIds.has(orderedColumnIds[i + 1])) {
      separatorColumnIds.add(orderedColumnIds[i]);
    }
  }

  const resolvedTableActions = React.useMemo(() => {
    if (!onRefresh) return tableActions;

    // 刷新动作由 DataTable 统一注入到操作栏前方，业务方无需在每个表格重复声明。
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
  const shouldRenderLoadingSkeleton =
    loadingSkeleton !== undefined && isLoading && rows.length === 0;
  const loadingSkeletonProps = shouldRenderLoadingSkeleton
    ? getDataTableLoadingSkeletonProps({ table, hasViewOptions, loadingSkeleton })
    : null;
  const pageRows = rows;
  // 选择统计优先使用外部受控值；未受控时只统计当前已加载页，避免误表达跨页全选。
  const resolvedSelectedRowCount =
    selectedRowCount ??
    (getSelectedRows ? getSelectedRows().length : getSelectedPageRowCount(table));
  const resolvedSelectedTotalRowCount =
    selectedRowCount !== undefined ? statusTotalCount : pageRows.length;
  const isExpanded = !!(expandConfig && expandedRow && expandPanelId);
  const {
    activeExpandTab,
    expandHostRef,
    expandSplitLayout,
    getExpandRowKey,
    handleExpandPanelClose,
    handleSplitKeyDown,
    handleSplitPointerDown,
    isDragging,
    paginationRef,
    setActiveExpandTab,
    topPanelRef
  } = useDataTableExpandPanel({
    expandConfig,
    expandedRow,
    expandedRowKey,
    isExpanded,
    onExpandedRowKeyChange
  });
  const isExpandLayoutActive = Boolean(
    isExpanded &&
    expandSplitLayout &&
    activeExpandTab &&
    expandConfig &&
    expandedRow &&
    expandPanelId
  );
  let topPanelStyle: React.CSSProperties | undefined;
  if (isExpandLayoutActive && expandSplitLayout?.isConstrained) {
    // 用户或配置已经指定主表高度时，用固定 flex-basis 保持上下分屏比例稳定。
    topPanelStyle = { flex: `0 0 ${expandSplitLayout.topPx}px` };
  } else if (isExpandLayoutActive) {
    // 未受约束时让主表自然吃满剩余空间，详情面板按内容和可用高度展示。
    topPanelStyle = { flex: '1 1 0%' };
  }

  if (loadingSkeletonProps) {
    return <DataTableSkeleton {...loadingSkeletonProps} />;
  }

  const tableViewport = (
    <div
      data-table-resize-overlay-root
      className={isExpandLayoutActive ? 'h-full rounded-lg' : 'absolute inset-0 rounded-lg'}
    >
      {/* 表格本体始终放在 ScrollArea 内，列宽预览、虚拟化和固定列阴影都以它为坐标系。 */}
      <ScrollArea
        className='h-full w-full'
        verticalScrollbarProps={{
          className: 'h-auto',
          style: {
            top: pinnedHeaderHeight ? `${pinnedHeaderHeight}px` : 0,
            bottom: DATA_TABLE_SCROLLBAR_SIZE_PX
          }
        }}
        horizontalScrollbarProps={{
          'data-left-pinned-width': pinnedLeftWidth || undefined,
          'data-right-pinned-width': pinnedRightWidth || undefined,
          style: {
            left: pinnedLeftWidth ? `${pinnedLeftWidth}px` : 0,
            right: pinnedRightWidth ? `${pinnedRightWidth}px` : 0
          }
        }}
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
              {/* fixed table layout 配合 colgroup/虚拟列宽，保证列宽由 TanStack state 控制。 */}
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
                          // 点击当前已展开行不重复触发，避免关闭/重开造成详情面板闪烁。
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
                // 拖拽 overlay 使用原始表头宽度，减少拖动时的视觉跳动。
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
    <div className='flex flex-1 flex-col gap-3'>
      {resolvedStatus?.type === 'permission' ? (
        // 权限态通常需要占满表格区域，以卡片方式展示，比嵌入 tbody 更清晰。
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
          <div
            ref={expandHostRef}
            className={`flex flex-1 min-h-0 min-w-0 flex-col${isExpandLayoutActive ? '' : ' gap-3'}`}
          >
            <div
              ref={topPanelRef}
              data-slot={isExpandLayoutActive ? 'data-table-expand-main' : undefined}
              className={
                isExpandLayoutActive ? 'relative min-h-0' : 'relative flex flex-1 min-h-[280px]'
              }
              style={topPanelStyle}
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
            {isExpandLayoutActive &&
            expandSplitLayout &&
            activeExpandTab &&
            expandConfig &&
            expandedRow &&
            expandPanelId ? (
              <>
                {/* 分屏 handle 同时支持鼠标拖拽和键盘 Arrow/Home/End 调整。 */}
                <DataTableExpandResizeHandle
                  min={expandSplitLayout.minTopPx}
                  max={expandSplitLayout.maxTopPx}
                  value={expandSplitLayout.topPx}
                  disabled={!expandSplitLayout.dragEnabled}
                  dragging={isDragging}
                  onKeyDown={handleSplitKeyDown}
                  onPointerDown={handleSplitPointerDown}
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
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
