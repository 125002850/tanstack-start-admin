import { Fragment } from 'react';
import { DataTableRowDetail } from '@/components/data-table/row-detail/data-table-row-detail';
import type { Row, Table } from '@tanstack/react-table';

import { DATA_TABLE_ROW_HEIGHT_PX } from '@/config/data-table';
import { TableBody, TableRow } from '@/components/ui/table';
import type { DataTableColumnVirtualWindow } from '@/components/data-table/virtualization/types';

import { FlowCell, FlowColumnWindowCells } from './cell';
import type { DataTableBodyCellServices, DataTableBodyRowInteraction } from './types';

export function StandardBody<TData>({
  table,
  rows,
  enableZebraStriping,
  columnVirtualWindow,
  cellServices,
  rowInteraction
}: {
  table: Table<TData>;
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
        <Fragment key={row.id}>
          <TableRow
            data-tree-row-id={cellServices.treeEnabled ? row.id : undefined}
            data-tree-depth={cellServices.treeEnabled ? row.depth : undefined}
            data-row-index={index}
            data-striped={enableZebraStriping && index % 2 === 1 ? 'true' : undefined}
            data-expanded={rowInteraction.isExpanded(row) ? 'true' : undefined}
            data-detail-expanded={
              table.options.meta?.dataTableRowDetail && row.getCanExpand() && row.getIsExpanded()
                ? 'true'
                : undefined
            }
            data-state={row.getIsSelected() ? 'selected' : undefined}
            aria-selected={row.getIsSelected() ? true : undefined}
            className={rowInteraction.className}
            onClick={(event) => rowInteraction.handleClick(event, row)}
            onKeyDown={(event) => rowInteraction.handleKeyDown(event, row)}
            tabIndex={rowInteraction.getTabIndex(row)}
            style={{ height: DATA_TABLE_ROW_HEIGHT_PX }}
          >
            {columnVirtualWindow?.enabled ? (
              <FlowColumnWindowCells
                row={row}
                window={columnVirtualWindow}
                services={cellServices}
              />
            ) : (
              row
                .getVisibleCells()
                .map((cell) => <FlowCell key={cell.id} cell={cell} services={cellServices} />)
            )}
          </TableRow>
          <DataTableRowDetail row={row} table={table} />
        </Fragment>
      ))}
    </TableBody>
  );
}
