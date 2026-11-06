import type { Cell, Row } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { EmptyBody } from '@/components/data-table/core/body/empty';
import { BodyRows } from '@/components/data-table/core/body/rows';
import type {
  DataTableBodyCellServices,
  DataTableBodyProps
} from '@/components/data-table/core/body/types';
import {
  shouldIgnoreRowExpandTarget,
  useRowInteraction
} from '@/components/data-table/core/body/use-row-interaction';
import { DataTableStatus } from '@/components/data-table/feedback/data-table-status';
import { useDataTableCellSelection } from '@/components/data-table/selection/use-data-table-cell-selection';
import { DataTableCellSelectionSummary } from '@/components/data-table/selection/data-table-cell-selection-summary';

function PopulatedBody<TData>({
  table,
  rows,
  selectionSummaryContainer,
  enableZebraStriping,
  virtualization,
  columnVirtualWindow,
  scrollToColumn,
  columnDragMotionById,
  isColumnDragging,
  useTransformFreeVirtualRows = false,
  scrollViewportRef,
  scrollViewport,
  headerRowRef,
  onRowClick,
  expandedRowKey,
  getExpandRowKey
}: Omit<DataTableBodyProps<TData>, 'emptyMessage' | 'status'> & { rows: Row<TData>[] }) {
  const treeEnabled = Boolean(table.options.meta?.dataTableTree);
  const {
    consumeSelectionClick,
    getCellFillHandleProps,
    getCellSelectionProps,
    getCellServerError,
    selectionModel
  } = useDataTableCellSelection<TData>({
    rows,
    columns: table.getVisibleLeafColumns(),
    matrixPasteColumns: table.getCenterLeafColumns(),
    scrollViewportRef,
    shouldIgnoreTarget: shouldIgnoreRowExpandTarget,
    editing: table.options.meta?.dataTableEditing
  });
  const rowInteraction = useRowInteraction({
    onRowClick,
    expandedRowKey,
    getExpandRowKey,
    shouldIgnoreClick: consumeSelectionClick
  });
  const renderCellServerError = useCallback(
    (cell: Cell<TData, unknown>) => {
      const state = getCellServerError(cell);
      return state ? (
        <>
          <span
            aria-hidden='true'
            data-slot='data-table-cell-server-error-marker'
            className='pointer-events-none absolute top-1 left-1 z-30 flex size-3.5 items-center justify-center rounded-full text-[10px] leading-none font-bold'
          >
            !
          </span>
          <span id={state.id} role='alert' className='sr-only'>
            {state.error.messages.join(' ')}
          </span>
        </>
      ) : null;
    },
    [getCellServerError]
  );
  const renderCellFillHandle = useCallback(
    (cell: Cell<TData, unknown>) => {
      const props = getCellFillHandleProps(cell);
      return props ? <button {...props} /> : null;
    },
    [getCellFillHandleProps]
  );
  const tableOptions = table.options;
  const cellServices = useMemo<DataTableBodyCellServices<TData>>(
    () => ({
      tableOptions,
      treeEnabled,
      columnDragMotionById,
      isColumnDragging,
      getCellSelectionProps,
      renderCellServerError,
      renderCellFillHandle
    }),
    [
      tableOptions,
      treeEnabled,
      columnDragMotionById,
      getCellSelectionProps,
      isColumnDragging,
      renderCellFillHandle,
      renderCellServerError
    ]
  );

  return (
    <>
      <BodyRows
        table={table}
        rows={rows}
        enableZebraStriping={enableZebraStriping}
        virtualization={virtualization}
        columnVirtualWindow={columnVirtualWindow}
        scrollToColumn={scrollToColumn}
        useTransformFreeVirtualRows={useTransformFreeVirtualRows}
        scrollViewport={scrollViewport}
        headerRowRef={headerRowRef}
        cellServices={cellServices}
        rowInteraction={rowInteraction}
      />
      {selectionSummaryContainer
        ? createPortal(
            <DataTableCellSelectionSummary model={selectionModel} />,
            selectionSummaryContainer
          )
        : null}
    </>
  );
}

/** tbody 门面：只负责 status、empty 与 populated 三态路由。 */
export function DataTableBody<TData>(props: DataTableBodyProps<TData>) {
  const rows = props.table.getRowModel().rows;
  if (props.status) {
    return <DataTableStatus status={props.status} colSpan={props.table.getAllColumns().length} />;
  }
  if (rows.length === 0) {
    return <EmptyBody colSpan={props.table.getAllColumns().length} message={props.emptyMessage} />;
  }
  return <PopulatedBody {...props} rows={rows} />;
}
