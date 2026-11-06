import type { Row } from '@tanstack/react-table';
import { memo } from 'react';

import { TableBody, TableRow } from '@/components/ui/table';
import type { DataTableColumnVirtualWindow } from '@/components/data-table/virtualization/types';
import { useHeaderWidths } from '@/components/data-table/virtualization/use-header-widths';
import type { DataTableRowVirtualizer } from '@/components/data-table/virtualization/use-row-virtualizer';

import { VirtualRowCell, VirtualRowColumnWindowCells } from './cell';
import type {
  DataTableBodyCellServices,
  DataTableBodyRowInteraction,
  DataTableVirtualBodyRowProps
} from './types';

function VirtualBodyRow<TData>({
  row,
  index,
  start,
  size,
  enableZebraStriping,
  useTransformFreeRows,
  columnVirtualWindow,
  getHeaderWidth,
  cellServices,
  rowInteraction
}: DataTableVirtualBodyRowProps<TData>) {
  return (
    <TableRow
      data-tree-row-id={cellServices.treeEnabled ? row.id : undefined}
      data-tree-depth={cellServices.treeEnabled ? row.depth : undefined}
      data-index={index}
      data-row-index={index}
      data-striped={enableZebraStriping && index % 2 === 1 ? 'true' : undefined}
      data-expanded={rowInteraction.isExpanded(row) ? 'true' : undefined}
      aria-rowindex={index + 2}
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
        top: useTransformFreeRows ? `${start}px` : 0,
        left: 0,
        width: '100%',
        height: `${size}px`,
        transform: useTransformFreeRows ? undefined : `translateY(${start}px)`
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
}

// 纯滚动时复用行；外层业务更新产生新的 rowInteraction，使稳定但可变的 table/row 刷新。
const MemoizedVirtualBodyRow = memo(VirtualBodyRow) as typeof VirtualBodyRow;

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
          <MemoizedVirtualBodyRow
            key={row.id}
            row={row}
            index={virtualRow.index}
            start={virtualRow.start}
            size={virtualRow.size}
            enableZebraStriping={enableZebraStriping}
            useTransformFreeRows={useTransformFreeRows}
            columnVirtualWindow={columnVirtualWindow}
            getHeaderWidth={getHeaderWidth}
            cellServices={cellServices}
            rowInteraction={rowInteraction}
          />
        );
      })}
    </TableBody>
  );
}
