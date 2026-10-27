import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type { Table as TanstackTable } from '@tanstack/react-table';
import { Table } from '@/components/ui/table';
import { DataTableCellTooltipProvider } from '../cells/data-table-cell-tooltip';
import { useComposedRefs } from '@/lib/compose-refs';
import { cn } from '@/lib/utils';
import type { DataTableVirtualizationProp } from '../virtualization/types';
import { useDataTableVirtualization } from '../virtualization/use-data-table-virtualization';
import { DataTableHeader } from './data-table-header';
import { DataTableBody } from './data-table-body';
import { DataTableColGroup } from './data-table-colgroup';

const noColumns = new Set<string>();
const noMotion = new Map();

/** 轻量表格内容：复用标准 thead/tbody，无工具栏和分页；默认自然高度，可按需启用虚拟化。 */
export function DataTableContent<TData>({
  table,
  label,
  emptyMessage = '暂无数据',
  virtualization = false,
  className,
  ref,
  ...viewportProps
}: ComponentProps<'div'> & {
  table: TanstackTable<TData>;
  label: string;
  emptyMessage?: ReactNode;
  virtualization?: DataTableVirtualizationProp;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRef = useRef<HTMLTableRowElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(null);
  const composedRef = useComposedRefs(viewportRef, setScrollViewport, ref);
  const {
    ariaRowCount,
    columnVirtualWindow,
    orderedLeafColumns,
    resolvedTableWidth,
    scrollToColumn,
    shouldVirtualizeColumns,
    useTransformFreeVirtualRows,
    virtConfig
  } = useDataTableVirtualization({ table, virtualization, scrollViewport });
  const separatorColumnIds = new Set(
    table
      .getCenterVisibleLeafColumns()
      .slice(0, -1)
      .map((column) => column.id)
  );
  return (
    <div ref={composedRef} className={cn('overflow-auto', className)} {...viewportProps}>
      <DataTableCellTooltipProvider>
        <Table
          ref={tableRef}
          aria-label={label}
          aria-rowcount={ariaRowCount}
          style={{ tableLayout: 'fixed', width: resolvedTableWidth, minWidth: '100%' }}
        >
          {shouldVirtualizeColumns ? null : <DataTableColGroup columns={orderedLeafColumns} />}
          <DataTableHeader
            table={table}
            tableElementRef={tableRef}
            headerRowRef={headerRef}
            columnVirtualWindow={columnVirtualWindow}
            shouldVirtualizeColumns={shouldVirtualizeColumns}
            separatorColumnIds={separatorColumnIds}
            draggableColumnIdSet={noColumns}
            columnDragMotionById={noMotion}
          />
          <DataTableBody
            table={table}
            emptyMessage={emptyMessage}
            enableZebraStriping={table.options.meta?.enableZebraStriping ?? false}
            scrollViewportRef={viewportRef}
            scrollViewport={scrollViewport}
            headerRowRef={headerRef}
            virtualization={virtConfig}
            columnVirtualWindow={columnVirtualWindow}
            scrollToColumn={scrollToColumn}
            useTransformFreeVirtualRows={useTransformFreeVirtualRows}
            columnDragMotionById={noMotion}
            isColumnDragging={false}
          />
        </Table>
      </DataTableCellTooltipProvider>
    </div>
  );
}
