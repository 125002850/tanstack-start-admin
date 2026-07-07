import { type Column, type Table as TanstackTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

import {
  DATA_TABLE_VIRTUAL_PRESET,
  resolveDataTableVirtualizationOptions
} from '@/config/data-table';
import { emitDataTableVirtualEvent } from '@/components/ui/table/virtualization/data-table-virtual-events';
import type {
  DataTableColumnRenderItem,
  DataTableColumnVirtualWindow,
  DataTableResolvedVirtualizationOptions,
  DataTableVirtualizationProp
} from '@/types/data-table';

/**
 * 解析 DataTable 的行/列虚拟化运行态。
 *
 * 这里集中处理：
 * - 全局环境开关和浏览器能力 gate；
 * - 行虚拟化阈值；
 * - 中间列虚拟化窗口；
 * - 固定列与 Safari transform 渲染兼容；
 * - 虚拟化回退事件通知。
 */
const DEFAULT_COLUMN_SIZE = 150;

/** SSR 或测试环境下没有 requestAnimationFrame 时退化为 setTimeout。 */
function requestAnimationFrameSafe(callback: FrameRequestCallback) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(performance.now()), 0) as unknown as number;
}

/** 与 requestAnimationFrameSafe 成对使用，避免测试环境泄露 timer。 */
function cancelAnimationFrameSafe(frameId: number) {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(frameId);
    return;
  }

  clearTimeout(frameId);
}

/** Safari 在 sticky + transform + 横向虚拟列组合下容易出现 fixed 列错位。 */
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

/** 把 TanStack Column 和虚拟窗口索引合并成 header/body 共用的渲染项。 */
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

/** 分组表头或 colSpan 表头无法安全裁剪中间列，因此列虚拟化必须回退。 */
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

export function useDataTableVirtualization<TData>({
  table,
  virtualization,
  scrollViewportRef
}: {
  table: TanstackTable<TData>;
  virtualization?: DataTableVirtualizationProp;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  // gate/fallback 事件按 reason 去重，避免每次 render 都刷诊断事件和回调。
  const lastVirtualizationGateReasonRef = React.useRef<string | null>(null);
  const lastColumnVirtualizationFallbackReasonRef = React.useRef<string | null>(null);
  const columnVirtualizationEnabledEmittedRef = React.useRef(false);

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
    // gateReason 表示“调用方想启用虚拟化，但环境或配置挡住了”。
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
  // leafIndex 指向完整可见列数组，表体需要用它从 row.getVisibleCells() 找回真实 cell。
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
    // 固定左列不参与中间列虚拟化，始终完整渲染。
    createColumnRenderItem({
      column,
      leafIndex: leafIndexByColumnId.get(column.id) ?? 0,
      centerIndex: -1,
      size: column.getSize()
    })
  );
  const rightColumnRenderItems = rightVisibleLeafColumns.map((column) =>
    // 固定右列同样完整渲染，并通过 getCommonPinningStyles 保持 sticky。
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
  // 右侧 padding 使用总尺寸减去最后一个虚拟列的 end，补齐横向滚动宽度。
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
  // Safari 组合场景下禁用 transform 定位，改用 top，避免 sticky 固定列和虚拟行错位。
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

  React.useEffect(() => {
    if (!shouldVirtualizeColumns || columnVirtualizationEnabledEmittedRef.current) {
      return;
    }

    columnVirtualizationEnabledEmittedRef.current = true;
    // 只在列虚拟化首次真正启用时记录一次，便于测试断言。
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
      // 列宽、显隐、拖拽状态变化后下一帧重新测量横向虚拟列。
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
    // 结构性回退（分组表头/colSpan）单独通知，方便调用方定位为什么列虚拟化未生效。
    emitDataTableVirtualEvent({
      event: 'columns-fallback',
      reason: columnVirtualizationFallbackReason
    });
    virtualizationResolution.onVirtualizationFallback?.(columnVirtualizationFallbackReason);
  }, [columnVirtualizationFallbackReason, virtualizationResolution]);

  return {
    ariaRowCount: shouldVirtualize ? table.getRowModel().rows.length + 1 : undefined,
    centerVisibleLeafColumns,
    columnVirtualWindow,
    orderedLeafColumns,
    resolvedTableWidth,
    shouldVirtualizeColumns,
    useTransformFreeVirtualRows,
    virtConfig
  };
}
