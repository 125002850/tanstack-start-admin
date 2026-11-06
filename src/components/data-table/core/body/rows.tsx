import { useCallback } from 'react';

import { useDataTableTreeFocus } from '@/components/data-table/tree/use-data-table-tree-focus';
import { VirtualBodyBoundary } from '@/components/data-table/virtualization/boundary';
import { useRowVirtualizer } from '@/components/data-table/virtualization/use-row-virtualizer';

import { StandardBody } from './standard';
import type { DataTableBodyRowsProps } from './types';
import { VirtualBody } from './virtual';

/** 独立订阅行滚动，避免虚拟窗口变化触发上层选区和行交互逻辑重跑。 */
export function BodyRows<TData>({
  table,
  rows,
  enableZebraStriping,
  virtualization,
  columnVirtualWindow,
  scrollToColumn,
  useTransformFreeVirtualRows = false,
  scrollViewport,
  headerRowRef,
  cellServices,
  rowInteraction
}: DataTableBodyRowsProps<TData>) {
  const ensureTreeColumnVisible = useCallback(() => {
    const treeColumnId = table.options.meta?.dataTableTree?.columnId;
    if (treeColumnId) scrollToColumn?.(treeColumnId);
  }, [scrollToColumn, table]);
  const state = table.getState();
  const localFilters = table.options.meta?.dataTableLocalFiltering?.filters;
  const resetKey = `${state.pagination.pageIndex}-${state.pagination.pageSize}-${JSON.stringify(state.sorting)}-${JSON.stringify(state.columnFilters)}-${JSON.stringify(localFilters ?? [])}`;
  const { handleRuntimeError, shouldVirtualize, virtualizer } = useRowVirtualizer({
    rows,
    resetKey,
    virtualization,
    scrollViewport
  });
  useDataTableTreeFocus({
    enabled: Boolean(cellServices.treeEnabled),
    rows,
    scrollViewport,
    virtualizer,
    shouldVirtualize,
    columnVirtualWindow,
    ensureTreeColumnVisible
  });
  const standardBody = (
    <StandardBody
      table={table}
      rows={rows}
      enableZebraStriping={enableZebraStriping}
      columnVirtualWindow={columnVirtualWindow}
      cellServices={cellServices}
      rowInteraction={rowInteraction}
    />
  );

  return shouldVirtualize ? (
    <VirtualBodyBoundary fallback={standardBody} onError={handleRuntimeError}>
      <VirtualBody
        rows={rows}
        enableZebraStriping={enableZebraStriping}
        columnVirtualWindow={columnVirtualWindow}
        useTransformFreeRows={useTransformFreeVirtualRows}
        headerRowRef={headerRowRef}
        virtualizer={virtualizer}
        cellServices={cellServices}
        rowInteraction={rowInteraction}
      />
    </VirtualBodyBoundary>
  ) : (
    standardBody
  );
}
