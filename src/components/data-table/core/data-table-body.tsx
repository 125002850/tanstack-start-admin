import type { Cell, Row } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';

import { EmptyBody } from '@/components/data-table/core/body/empty';
import { StandardBody } from '@/components/data-table/core/body/standard';
import type {
  DataTableBodyCellServices,
  DataTableBodyProps
} from '@/components/data-table/core/body/types';
import { useRowInteraction } from '@/components/data-table/core/body/use-row-interaction';
import { VirtualBody } from '@/components/data-table/core/body/virtual';
import { DataTableStatus } from '@/components/data-table/feedback/data-table-status';
import { useDataTableCellSelection } from '@/components/data-table/selection/use-data-table-cell-selection';
import { VirtualBodyBoundary } from '@/components/data-table/virtualization/boundary';
import { useRowVirtualizer } from '@/components/data-table/virtualization/use-row-virtualizer';

function PopulatedBody<TData>({
  table,
  rows,
  enableZebraStriping,
  virtualization,
  columnVirtualWindow,
  columnDragMotionById,
  isColumnDragging,
  useTransformFreeVirtualRows = false,
  scrollViewportRef,
  headerRowRef,
  onRowClick,
  expandedRowKey,
  getExpandRowKey
}: Omit<DataTableBodyProps<TData>, 'emptyMessage' | 'status'> & { rows: Row<TData>[] }) {
  const rowInteraction = useRowInteraction({ onRowClick, expandedRowKey, getExpandRowKey });
  const { getCellFillHandleProps, getCellSelectionProps, getCellServerError } =
    useDataTableCellSelection<TData>({
      rows,
      columns: table.getVisibleLeafColumns(),
      matrixPasteColumns: table.getCenterLeafColumns(),
      scrollViewportRef,
      shouldIgnoreTarget: rowInteraction.shouldIgnoreTarget,
      editing: table.options.meta?.dataTableEditing
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
  const cellServices = useMemo<DataTableBodyCellServices<TData>>(
    () => ({
      columnDragMotionById,
      isColumnDragging,
      getCellSelectionProps,
      renderCellServerError,
      renderCellFillHandle
    }),
    [
      columnDragMotionById,
      getCellSelectionProps,
      isColumnDragging,
      renderCellFillHandle,
      renderCellServerError
    ]
  );
  const state = table.getState();
  const localFilters = table.options.meta?.dataTableLocalFiltering?.filters;
  const resetKey = `${state.pagination.pageIndex}-${state.pagination.pageSize}-${JSON.stringify(state.sorting)}-${JSON.stringify(state.columnFilters)}-${JSON.stringify(localFilters ?? [])}`;
  const { handleRuntimeError, shouldVirtualize, virtualizer } = useRowVirtualizer({
    rowCount: rows.length,
    resetKey,
    virtualization,
    scrollViewportRef
  });
  const standardBody = (
    <StandardBody
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
