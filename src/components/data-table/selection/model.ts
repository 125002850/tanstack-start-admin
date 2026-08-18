import { type Cell, type Column, type Row } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID
} from '@/hooks/use-data-table/constants';
import type { DataTableEditableColumnMeta } from '../editing/types';
import {
  createDataTableCellRangeIndex,
  resolveDataTableCellRangeBounds,
  type DataTableCellCoordinate,
  type DataTableCellRange,
  type DataTableCellRangeBounds
} from './data-table-cell-range';
import type { DataTableCellSelectionModel } from './types';

export function canSelectDataTableColumn<TData>(column: Column<TData, unknown>): boolean {
  return (
    column.id !== DATA_TABLE_ROW_NUMBER_COLUMN_ID &&
    column.id !== DATA_TABLE_ACTIONS_COLUMN_ID &&
    !column.getIsPinned()
  );
}

export function canSelectDataTableCell<TData>(cell: Cell<TData, unknown>): boolean {
  return canSelectDataTableColumn(cell.column);
}

export function getCoordinateKey({ rowId, columnId }: DataTableCellCoordinate) {
  return `${rowId}\u0000${columnId}`;
}

export function getCellCoordinate<TData>(cell: Cell<TData, unknown>): DataTableCellCoordinate {
  return { rowId: cell.row.id, columnId: cell.column.id };
}

export function getEditableCellMeta<TData>(
  cell: Cell<TData, unknown>
): DataTableEditableColumnMeta<TData> | undefined {
  return getEditableColumnMeta(cell.column);
}

export function getEditableColumnMeta<TData>(
  column: Column<TData, unknown>
): DataTableEditableColumnMeta<TData> | undefined {
  return column.columnDef.meta?.editableCell ?? column.columnDef.meta?.editableChoice;
}

export function isSameCoordinate(
  left: DataTableCellCoordinate,
  right: DataTableCellCoordinate
): boolean {
  return left.rowId === right.rowId && left.columnId === right.columnId;
}

export function isSameRange(
  left: DataTableCellRange | null,
  right: DataTableCellRange | null
): boolean {
  return Boolean(
    left &&
    right &&
    isSameCoordinate(left.anchor, right.anchor) &&
    isSameCoordinate(left.focus, right.focus)
  );
}

export function createRangeFromBounds(
  bounds: DataTableCellRangeBounds,
  rowIds: readonly string[],
  columnIds: readonly string[]
): DataTableCellRange | null {
  const anchorRowId = rowIds[bounds.rowStart];
  const anchorColumnId = columnIds[bounds.columnStart];
  const focusRowId = rowIds[bounds.rowEnd];
  const focusColumnId = columnIds[bounds.columnEnd];
  return anchorRowId && anchorColumnId && focusRowId && focusColumnId
    ? {
        anchor: { rowId: anchorRowId, columnId: anchorColumnId },
        focus: { rowId: focusRowId, columnId: focusColumnId }
      }
    : null;
}

export function unionRangeBounds(
  left: DataTableCellRangeBounds,
  right: DataTableCellRangeBounds
): DataTableCellRangeBounds {
  return {
    rowStart: Math.min(left.rowStart, right.rowStart),
    rowEnd: Math.max(left.rowEnd, right.rowEnd),
    columnStart: Math.min(left.columnStart, right.columnStart),
    columnEnd: Math.max(left.columnEnd, right.columnEnd)
  };
}

export function useDataTableCellSelectionModel<TData>({
  rows,
  columns,
  matrixPasteColumns,
  range
}: {
  rows: readonly Row<TData>[];
  columns: readonly Column<TData, unknown>[];
  matrixPasteColumns?: readonly Column<TData, unknown>[];
  range: DataTableCellRange | null;
}): DataTableCellSelectionModel<TData> {
  const selectableColumns = useMemo(() => columns.filter(canSelectDataTableColumn), [columns]);
  const pasteColumns = useMemo(
    () => matrixPasteColumns ?? selectableColumns,
    [matrixPasteColumns, selectableColumns]
  );
  const columnLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const column of pasteColumns) {
      const editable = getEditableColumnMeta(column);
      if (editable?.title) labels.set(column.id, editable.title);
    }
    return labels;
  }, [pasteColumns]);
  const resolveColumnLabel = useCallback(
    (columnId: string) => columnLabelById.get(columnId) ?? columnId,
    [columnLabelById]
  );
  const matrixPasteColumnContracts = useMemo(
    () =>
      pasteColumns.map((column) => ({
        columnId: column.id,
        visible: column.getIsVisible(),
        editableCell: getEditableColumnMeta(column),
        copyValue: column.columnDef.meta?.copyValue
      })),
    [pasteColumns]
  );
  const rightPinnedColumnIds = useMemo(
    () => columns.filter((column) => column.getIsPinned() === 'right').map((column) => column.id),
    [columns]
  );
  const rangeIndex = useMemo(
    () =>
      createDataTableCellRangeIndex(
        rows.map((row) => row.id),
        selectableColumns.map((column) => column.id)
      ),
    [rows, selectableColumns]
  );
  const rangeBounds = useMemo(
    () => (range ? resolveDataTableCellRangeBounds(range, rangeIndex) : null),
    [range, rangeIndex]
  );
  const cellsByCoordinate = useMemo(() => {
    const cells = new Map<string, Cell<TData, unknown>>();
    for (const row of rows) {
      for (const cell of row.getVisibleCells()) {
        if (canSelectDataTableCell(cell)) {
          cells.set(getCoordinateKey(getCellCoordinate(cell)), cell);
        }
      }
    }
    return cells;
  }, [rows]);

  return {
    selectableColumns,
    pasteColumns,
    resolveColumnLabel,
    matrixPasteColumnContracts,
    rightPinnedColumnIds,
    rangeIndex,
    rangeBounds,
    cellsByCoordinate
  };
}
