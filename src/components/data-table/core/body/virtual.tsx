import type { Row } from '@tanstack/react-table';

import { TableBody, TableRow } from '@/components/ui/table';
import type { DataTableColumnVirtualWindow } from '@/components/data-table/virtualization/types';
import { useHeaderWidths } from '@/components/data-table/virtualization/use-header-widths';
import type { DataTableRowVirtualizer } from '@/components/data-table/virtualization/use-row-virtualizer';

import { VirtualRowCell, VirtualRowColumnWindowCells } from './cell';
import type { DataTableBodyCellServices, DataTableBodyRowInteraction } from './types';

export function VirtualBody<TData>({
  rows,
  enableZebraStriping,
  columnVirtualWindow,
  useTransformFreeRows,
  headerRowRef,
  virtualizer,
  cellServices,
  rowInteraction
}: {
  rows: Row<TData>[];
  enableZebraStriping: boolean;
  columnVirtualWindow?: DataTableColumnVirtualWindow<TData>;
  useTransformFreeRows: boolean;
  headerRowRef: React.RefObject<HTMLTableRowElement | null>;
  virtualizer: DataTableRowVirtualizer;
  cellServices: DataTableBodyCellServices<TData>;
  rowInteraction: DataTableBodyRowInteraction<TData>;
}) {
  const getHeaderWidth = useHeaderWidths(headerRowRef);
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const firstIndex = virtualItems[0]?.index ?? 0;
  const lastIndex = virtualItems.at(-1)?.index ?? 0;

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
            data-striped={enableZebraStriping && virtualRow.index % 2 === 1 ? 'true' : undefined}
            data-expanded={rowInteraction.isExpanded(row) ? 'true' : undefined}
            aria-rowindex={virtualRow.index + 2}
            aria-selected={row.getIsSelected() ? true : undefined}
            data-state={row.getIsSelected() ? 'selected' : undefined}
            className={rowInteraction.className}
            onClick={(event) => rowInteraction.handleClick(event, row)}
            onKeyDown={(event) => rowInteraction.handleKeyDown(event, row)}
            tabIndex={rowInteraction.getTabIndex(row)}
            style={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              top: useTransformFreeRows ? `${virtualRow.start}px` : 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: useTransformFreeRows ? undefined : `translateY(${virtualRow.start}px)`
            }}
            data-virtual-row-positioning={useTransformFreeRows ? 'top' : 'transform'}
          >
            {columnVirtualWindow?.enabled ? (
              <VirtualRowColumnWindowCells
                row={row}
                window={columnVirtualWindow}
                services={cellServices}
              />
            ) : (
              row
                .getVisibleCells()
                .map((cell) => (
                  <VirtualRowCell
                    key={cell.id}
                    cell={cell}
                    measuredWidth={getHeaderWidth(cell.column.id)}
                    services={cellServices}
                  />
                ))
            )}
          </TableRow>
        );
      })}
    </TableBody>
  );
}
