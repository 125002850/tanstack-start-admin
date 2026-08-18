import { flexRender, type Cell, type Row } from '@tanstack/react-table';
import type { CSSProperties, ReactNode } from 'react';

import { DataTableRowActions } from '@/components/data-table/actions/data-table-row-action';
import { DataTableCellContent } from '@/components/data-table/cells/data-table-cell-content';
import { resolveDataTableColumnDragCellMotion } from '@/components/data-table/dnd/data-table-column-drag-motion';
import { TableCell } from '@/components/ui/table';
import {
  getColumnPinningShadow,
  getColumnPinningShadowOverlayStyle,
  getCommonPinningStyles
} from '@/components/data-table/core/data-table-pinning';
import type {
  DataTableColumnRenderItem,
  DataTableColumnVirtualWindow
} from '@/components/data-table/virtualization/types';

import type { DataTableBodyCellServices } from './types';

const CELL_CLASS_NAME =
  'relative px-[15px] py-0 outline outline-1 outline-offset-[-1px] outline-transparent transition-[outline-color,box-shadow] duration-150 ease-out';

function offsetPinnedCellByOnePixel(offset: CSSProperties['left']): CSSProperties['left'] {
  if (typeof offset === 'number') return offset - 1;
  if (typeof offset !== 'string') return '-1px';
  const pixelValue = Number.parseFloat(offset);
  if (Number.isFinite(pixelValue) && offset.trim().endsWith('px')) {
    return `${pixelValue - 1}px`;
  }
  return `calc(${offset} - 1px)`;
}

function getBodyCellPinningStyles<TData>(cell: Cell<TData, unknown>): CSSProperties {
  const styles = getCommonPinningStyles({ column: cell.column });
  const side = cell.column.getIsPinned();
  if (side === 'left') return { ...styles, left: offsetPinnedCellByOnePixel(styles.left) };
  if (side === 'right') return { ...styles, right: offsetPinnedCellByOnePixel(styles.right) };
  return styles;
}

function renderCellValue<TData>(cell: Cell<TData, unknown>) {
  const rowActions = cell.getContext().table.options.meta?.dataTableRowActions;
  return cell.column.id === 'actions' && rowActions?.length ? (
    <DataTableRowActions row={cell.row.original} actions={rowActions} />
  ) : (
    flexRender(cell.column.columnDef.cell, cell.getContext())
  );
}

function PinnedCellSurface<TData>({
  cell,
  children
}: {
  cell: Cell<TData, unknown>;
  children: ReactNode;
}) {
  const pinnedSide = cell.column.getIsPinned();
  if (!pinnedSide) return children;
  const pinningShadow = getColumnPinningShadow({ column: cell.column });
  const shadowEdge = pinningShadow ? (pinnedSide === 'left' ? 'right' : 'left') : undefined;
  const shadowStyle = shadowEdge ? getColumnPinningShadowOverlayStyle(shadowEdge) : undefined;

  return (
    <>
      <div
        aria-hidden='true'
        data-slot='data-table-pinned-cell-base'
        data-pinning-shadow-edge={shadowEdge}
        className='pointer-events-none absolute inset-0 transition-colors'
      />
      {shadowStyle ? (
        <div
          aria-hidden='true'
          data-slot='data-table-pinned-cell-shadow'
          data-pinning-shadow-edge={shadowEdge}
          className='pointer-events-none absolute top-0 bottom-0 z-[1]'
          style={shadowStyle}
        />
      ) : null}
      <div className='relative z-10 w-full'>{children}</div>
    </>
  );
}

function CellFrame<TData>({
  cell,
  services,
  style,
  leafIndex,
  centerIndex
}: {
  cell: Cell<TData, unknown>;
  services: DataTableBodyCellServices<TData>;
  style?: CSSProperties;
  leafIndex?: number;
  centerIndex?: number;
}) {
  const dragMotion = resolveDataTableColumnDragCellMotion(
    services.columnDragMotionById,
    cell.column.id,
    services.isColumnDragging
  );

  return (
    <TableCell
      data-column-id={cell.column.id}
      data-column-leaf-index={leafIndex}
      data-column-center-index={
        centerIndex !== undefined && centerIndex >= 0 ? centerIndex : undefined
      }
      data-column-drag-motion={dragMotion ? 'true' : undefined}
      className={CELL_CLASS_NAME}
      {...services.getCellSelectionProps(cell)}
      style={{
        ...getBodyCellPinningStyles(cell),
        ...style,
        ...dragMotion?.cellStyle
      }}
    >
      <PinnedCellSurface cell={cell}>
        <DataTableCellContent cell={cell}>{renderCellValue(cell)}</DataTableCellContent>
      </PinnedCellSurface>
      {services.renderCellServerError(cell)}
      {services.renderCellFillHandle(cell)}
    </TableCell>
  );
}

export function FlowCell<TData>({
  cell,
  services
}: {
  cell: Cell<TData, unknown>;
  services: DataTableBodyCellServices<TData>;
}) {
  return <CellFrame cell={cell} services={services} />;
}

export function VirtualRowCell<TData>({
  cell,
  measuredWidth,
  services
}: {
  cell: Cell<TData, unknown>;
  measuredWidth?: number;
  services: DataTableBodyCellServices<TData>;
}) {
  const pinningWidth = getBodyCellPinningStyles(cell).width as number | undefined;
  return (
    <CellFrame
      cell={cell}
      services={services}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        width: measuredWidth ?? pinningWidth ?? cell.column.getSize()
      }}
    />
  );
}

function getColumnWidthStyle(size: number): CSSProperties {
  return { width: size, minWidth: size, maxWidth: size };
}

type ColumnWindowLayout = 'flow' | 'virtual-row';

function ColumnWindowCell<TData>({
  row,
  item,
  layout,
  services
}: {
  row: Row<TData>;
  item: DataTableColumnRenderItem<TData>;
  layout: ColumnWindowLayout;
  services: DataTableBodyCellServices<TData>;
}) {
  const cell = row.getVisibleCells()[item.leafIndex] as Cell<TData, unknown> | undefined;
  if (!cell) return null;
  return (
    <CellFrame
      cell={cell}
      services={services}
      leafIndex={item.leafIndex}
      centerIndex={item.centerIndex}
      style={{
        ...(layout === 'virtual-row'
          ? { display: 'flex', alignItems: 'center', height: '100%' }
          : {}),
        ...getColumnWidthStyle(item.size)
      }}
    />
  );
}

function ColumnWindowSpacer({
  side,
  size,
  layout
}: {
  side: 'left' | 'right';
  size: number;
  layout: ColumnWindowLayout;
}) {
  if (size <= 0) return null;
  return (
    <TableCell
      aria-hidden='true'
      data-column-virtual-spacer={side}
      style={{
        ...getColumnWidthStyle(size),
        ...(layout === 'virtual-row'
          ? { display: 'flex', alignItems: 'center', height: '100%' }
          : {})
      }}
    />
  );
}

type ColumnWindowCellsProps<TData> = {
  row: Row<TData>;
  window: DataTableColumnVirtualWindow<TData>;
  services: DataTableBodyCellServices<TData>;
};

function ColumnWindowCells<TData>({
  row,
  window,
  layout,
  services
}: ColumnWindowCellsProps<TData> & {
  layout: ColumnWindowLayout;
}) {
  const renderItem = (item: DataTableColumnRenderItem<TData>) => (
    <ColumnWindowCell
      key={item.columnId}
      row={row}
      item={item}
      layout={layout}
      services={services}
    />
  );
  return (
    <>
      {window.leftItems.map(renderItem)}
      <ColumnWindowSpacer side='left' size={window.virtualPaddingLeft} layout={layout} />
      {window.items.map(renderItem)}
      <ColumnWindowSpacer side='right' size={window.virtualPaddingRight} layout={layout} />
      {window.rightItems.map(renderItem)}
    </>
  );
}

export function FlowColumnWindowCells<TData>(props: ColumnWindowCellsProps<TData>) {
  return <ColumnWindowCells {...props} layout='flow' />;
}

export function VirtualRowColumnWindowCells<TData>(props: ColumnWindowCellsProps<TData>) {
  return <ColumnWindowCells {...props} layout='virtual-row' />;
}
