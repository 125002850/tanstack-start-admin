import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  flexRender,
  type Column,
  type Header,
  type Table as TanstackTable
} from '@tanstack/react-table';
import * as React from 'react';

import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTableColumnResizeHandle } from '@/components/ui/table/data-table-column-resize-handle';
import { DataTableOverflowTooltipText } from '@/components/ui/table/data-table-overflow-tooltip-text';
import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID
} from '@/hooks/use-data-table/constants';
import { getCommonPinningStyles } from '@/lib/data-table';
import { getDataTableColumnLabel } from '@/lib/data-table-column-label';
import { cn } from '@/lib/utils';
import type { DataTableColumnRenderItem, DataTableColumnVirtualWindow } from '@/types/data-table';

const HEADER_ROW_HEIGHT_PX = 40;
const HEADER_STICKY_TOP_OFFSET_PX = -1;
const NON_REORDERABLE_COLUMN_IDS = new Set([
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID,
  DATA_TABLE_ACTIONS_COLUMN_ID
]);

interface DataTableHeaderProps<TData> {
  table: TanstackTable<TData>;
  columnVirtualWindow: DataTableColumnVirtualWindow<TData>;
  shouldVirtualizeColumns: boolean;
  separatorColumnIds: Set<string>;
  draggableColumnIdSet: Set<string>;
  headerRowRef: React.Ref<HTMLTableRowElement>;
  onHeaderClickCapture: React.MouseEventHandler<HTMLTableCellElement>;
}

interface HeaderCellBaseProps<TData> {
  header: Header<TData, unknown>;
  className?: string;
  style?: React.CSSProperties;
  dataAttributes?: Record<string, string | number | undefined>;
  onClickCapture?: React.MouseEventHandler<HTMLTableCellElement>;
}

function getColumnVirtualCellWidthStyle(size: number): React.CSSProperties {
  return {
    width: size,
    minWidth: size,
    maxWidth: size
  };
}

function isTextLikeHeaderNode(content: React.ReactNode): content is string | number | bigint {
  const type = typeof content;
  return type === 'string' || type === 'number' || type === 'bigint';
}

function renderHeaderContent<TData>(header: Header<TData, unknown>) {
  const content = flexRender(header.column.columnDef.header, header.getContext());

  if (isTextLikeHeaderNode(content)) {
    return (
      <DataTableOverflowTooltipText value={String(content)}>{content}</DataTableOverflowTooltipText>
    );
  }

  return content;
}

export function getCanReorderColumn<TData>(column: Column<TData, unknown>) {
  return !column.getIsPinned() && !NON_REORDERABLE_COLUMN_IDS.has(column.id);
}

function getHeaderLabel<TData>(header: Header<TData, unknown>) {
  return getDataTableColumnLabel(header.column, header.getContext().table);
}

function getStickyHeaderCellStyles<TData>(
  header: Header<TData, unknown>,
  rowIndex: number,
  styles?: React.CSSProperties
): React.CSSProperties {
  const pinnedSide = header.column.getIsPinned();

  return {
    ...styles,
    position: 'sticky',
    top: rowIndex * HEADER_ROW_HEIGHT_PX + HEADER_STICKY_TOP_OFFSET_PX,
    zIndex: pinnedSide ? 12 : 10
  };
}

function getHeaderClassName<TData>(
  header: Header<TData, unknown>,
  separatorColumnIds: Set<string>
) {
  return cn(
    'bg-muted',
    separatorColumnIds.has(header.column.id) &&
      'after:content-[""] after:pointer-events-none after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-px after:h-4 after:rounded-full after:bg-muted-foreground/25'
  );
}

export function DataTableHeaderDragOverlay<TData>({
  header,
  width
}: {
  header: Header<TData, unknown>;
  width: number | null;
}) {
  return (
    <div
      data-slot='data-table-column-drag-overlay'
      className='bg-popover text-popover-foreground flex h-10 items-center rounded-md border px-2 text-sm font-medium shadow-md'
      style={width ? { width } : undefined}
    >
      <span className='truncate'>{getHeaderLabel(header)}</span>
    </div>
  );
}

function StaticDataTableHeaderCell<TData>({
  header,
  className,
  style,
  dataAttributes,
  onClickCapture
}: HeaderCellBaseProps<TData>) {
  return (
    <TableHead
      key={header.id}
      colSpan={header.colSpan}
      className={className}
      style={style}
      onClickCapture={onClickCapture}
      {...dataAttributes}
    >
      {header.isPlaceholder ? null : renderHeaderContent(header)}
      <DataTableColumnResizeHandle header={header} />
    </TableHead>
  );
}

function SortableDataTableHeaderCell<TData>({
  header,
  className,
  style,
  dataAttributes,
  onClickCapture
}: HeaderCellBaseProps<TData>) {
  const { listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: header.column.id });

  const sortableStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...style,
      opacity: isDragging ? 0.45 : style?.opacity,
      transform: CSS.Transform.toString(transform),
      transition
    }),
    [isDragging, style, transform, transition]
  );

  return (
    <TableHead
      ref={setNodeRef}
      key={header.id}
      colSpan={header.colSpan}
      className={className}
      style={sortableStyle}
      onClickCapture={onClickCapture}
      data-reordering={isDragging ? 'true' : undefined}
      {...dataAttributes}
    >
      <div
        ref={setActivatorNodeRef}
        data-slot='data-table-column-order-activator'
        className={cn('flex min-w-0 items-center', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
        {...listeners}
      >
        {header.isPlaceholder ? null : renderHeaderContent(header)}
      </div>
      <DataTableColumnResizeHandle header={header} />
    </TableHead>
  );
}

export function DataTableHeader<TData>({
  table,
  columnVirtualWindow,
  shouldVirtualizeColumns,
  separatorColumnIds,
  draggableColumnIdSet,
  headerRowRef,
  onHeaderClickCapture
}: DataTableHeaderProps<TData>) {
  const flatHeaderGroup = table.getHeaderGroups()[0];
  const headerByColumnId = new Map(
    flatHeaderGroup?.headers.map((header) => [header.column.id, header]) ?? []
  );

  const renderHeaderCell = (
    item: DataTableColumnRenderItem<TData>,
    options?: { virtualizedCenter?: boolean }
  ) => {
    const header = headerByColumnId.get(item.columnId);
    if (!header) return null;
    const pinningStyles = getCommonPinningStyles({ column: header.column });
    const widthStyles = options?.virtualizedCenter ? getColumnVirtualCellWidthStyle(item.size) : {};
    const headerStyle = getStickyHeaderCellStyles(header, 0, {
      ...pinningStyles,
      ...widthStyles
    });
    const HeaderCell = draggableColumnIdSet.has(header.column.id)
      ? SortableDataTableHeaderCell
      : StaticDataTableHeaderCell;

    return (
      <HeaderCell
        key={header.id}
        header={header}
        className={getHeaderClassName(header, separatorColumnIds)}
        style={headerStyle}
        dataAttributes={{
          'data-column-id': item.columnId,
          'data-column-leaf-index': item.leafIndex,
          'data-column-center-index': item.centerIndex >= 0 ? item.centerIndex : undefined
        }}
        onClickCapture={onHeaderClickCapture}
      />
    );
  };

  const renderHeaderSpacer = (side: 'left' | 'right', size: number) => {
    if (size <= 0) return null;

    return (
      <TableHead
        key={`column-virtual-spacer-${side}`}
        aria-hidden='true'
        data-column-virtual-spacer={side}
        className='bg-muted'
        style={{
          ...getColumnVirtualCellWidthStyle(size),
          position: 'sticky',
          top: HEADER_STICKY_TOP_OFFSET_PX,
          zIndex: 10
        }}
      />
    );
  };

  return (
    <TableHeader className='bg-muted'>
      {shouldVirtualizeColumns && flatHeaderGroup ? (
        <TableRow key={flatHeaderGroup.id} ref={headerRowRef}>
          {columnVirtualWindow.leftItems.map((item) => renderHeaderCell(item))}
          {renderHeaderSpacer('left', columnVirtualWindow.virtualPaddingLeft)}
          {columnVirtualWindow.items.map((item) =>
            renderHeaderCell(item, { virtualizedCenter: true })
          )}
          {renderHeaderSpacer('right', columnVirtualWindow.virtualPaddingRight)}
          {columnVirtualWindow.rightItems.map((item) => renderHeaderCell(item))}
        </TableRow>
      ) : (
        table.getHeaderGroups().map((headerGroup, headerGroupIndex) => (
          <TableRow key={headerGroup.id} ref={headerRowRef}>
            {headerGroup.headers.map((header) => {
              const HeaderCell =
                header.colSpan === 1 && draggableColumnIdSet.has(header.column.id)
                  ? SortableDataTableHeaderCell
                  : StaticDataTableHeaderCell;

              return (
                <HeaderCell
                  key={header.id}
                  header={header}
                  className={getHeaderClassName(header, separatorColumnIds)}
                  style={getStickyHeaderCellStyles(header, headerGroupIndex, {
                    ...getCommonPinningStyles({ column: header.column })
                  })}
                  dataAttributes={{
                    'data-column-id': header.column.id
                  }}
                  onClickCapture={onHeaderClickCapture}
                />
              );
            })}
          </TableRow>
        ))
      )}
    </TableHeader>
  );
}
