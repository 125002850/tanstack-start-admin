import type { Row } from '@tanstack/react-table';

import { DATA_TABLE_ROW_HEIGHT_PX } from '@/config/data-table';
import { TableBody, TableRow } from '@/components/ui/table';
import type { DataTableColumnVirtualWindow } from '@/components/data-table/virtualization/types';

import { FlowCell, FlowColumnWindowCells } from './cell';
import type { DataTableBodyCellServices, DataTableBodyRowInteraction } from './types';

export function StandardBody<TData>({
  rows,
  enableZebraStriping,
  columnVirtualWindow,
  cellServices,
  rowInteraction
}: {
  rows: Row<TData>[];
  enableZebraStriping: boolean;
  columnVirtualWindow?: DataTableColumnVirtualWindow<TData>;
  cellServices: DataTableBodyCellServices<TData>;
  rowInteraction: DataTableBodyRowInteraction<TData>;
}) {
  return (
    <TableBody
      data-component='data-table-body'
      data-column-virtual-enabled={columnVirtualWindow?.enabled ? 'true' : undefined}
      data-column-virtual-count={
        columnVirtualWindow?.enabled ? columnVirtualWindow.items.length : undefined
      }
    >
      {rows.map((row, index) => (
        <TableRow
          key={row.id}
          data-row-index={index}
          data-striped={enableZebraStriping && index % 2 === 1 ? 'true' : undefined}
          data-expanded={rowInteraction.isExpanded(row) ? 'true' : undefined}
          data-state={row.getIsSelected() ? 'selected' : undefined}
          aria-selected={row.getIsSelected() ? true : undefined}
          className={rowInteraction.className}
          onClick={(event) => rowInteraction.handleClick(event, row)}
          onKeyDown={(event) => rowInteraction.handleKeyDown(event, row)}
          tabIndex={rowInteraction.getTabIndex(row)}
          style={{ height: DATA_TABLE_ROW_HEIGHT_PX }}
        >
          {columnVirtualWindow?.enabled ? (
            <FlowColumnWindowCells row={row} window={columnVirtualWindow} services={cellServices} />
          ) : (
            row
              .getVisibleCells()
              .map((cell) => <FlowCell key={cell.id} cell={cell} services={cellServices} />)
          )}
        </TableRow>
      ))}
    </TableBody>
  );
}
