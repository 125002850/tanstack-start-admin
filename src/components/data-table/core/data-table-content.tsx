import { useRef, type ReactNode } from 'react';
import type { Table as TanstackTable } from '@tanstack/react-table';
import { Table } from '@/components/ui/table';
import { DataTableCellTooltipProvider } from '../cells/data-table-cell-tooltip';
import type { DataTableColumnVirtualWindow } from '../virtualization/types';
import { DataTableHeader } from './data-table-header';
import { DataTableBody } from './data-table-body';
import { DataTableColGroup } from './data-table-colgroup';

const noColumns = new Set<string>();
const noMotion = new Map();

/** 轻量表格内容：复用标准 thead/tbody，无工具栏、分页、虚拟化或固定高度。 */
export function DataTableContent<TData>({
  table,
  label,
  emptyMessage = '暂无数据'
}: {
  table: TanstackTable<TData>;
  label: string;
  emptyMessage?: ReactNode;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRef = useRef<HTMLTableRowElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const separatorColumnIds = new Set(
    table
      .getCenterVisibleLeafColumns()
      .slice(0, -1)
      .map((column) => column.id)
  );
  const columnWindow: DataTableColumnVirtualWindow<TData> = {
    enabled: false,
    items: [],
    leftItems: [],
    rightItems: [],
    virtualPaddingLeft: 0,
    virtualPaddingRight: 0,
    virtualTotalSize: 0
  };
  return (
    <div ref={viewportRef} className='overflow-x-auto'>
      <DataTableCellTooltipProvider>
        <Table
          ref={tableRef}
          aria-label={label}
          style={{ tableLayout: 'fixed', width: table.getTotalSize(), minWidth: '100%' }}
        >
          <DataTableColGroup columns={table.getVisibleLeafColumns()} />
          <DataTableHeader
            table={table}
            tableElementRef={tableRef}
            headerRowRef={headerRef}
            columnVirtualWindow={columnWindow}
            shouldVirtualizeColumns={false}
            separatorColumnIds={separatorColumnIds}
            draggableColumnIdSet={noColumns}
            columnDragMotionById={noMotion}
          />
          <DataTableBody
            table={table}
            emptyMessage={emptyMessage}
            enableZebraStriping={table.options.meta?.enableZebraStriping ?? false}
            scrollViewportRef={viewportRef}
            scrollViewport={null}
            headerRowRef={headerRef}
            columnDragMotionById={noMotion}
            isColumnDragging={false}
          />
        </Table>
      </DataTableCellTooltipProvider>
    </div>
  );
}
