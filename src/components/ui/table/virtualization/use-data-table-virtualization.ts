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

const DEFAULT_COLUMN_SIZE = 150;

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

export function useDataTableVirtualization<TData>({
  table,
  virtualization,
  scrollViewportRef
}: {
  table: TanstackTable<TData>;
  virtualization?: DataTableVirtualizationProp;
  scrollViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
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
