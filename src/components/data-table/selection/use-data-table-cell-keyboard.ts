import type { Cell, Column } from '@tanstack/react-table';
import {
  useCallback,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction
} from 'react';
import { toast } from 'sonner';

import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableEditableColumnMeta, DataTableEditingRuntime } from '../editing/types';
import {
  moveDataTableCellCoordinate,
  type DataTableCellCoordinate,
  type DataTableCellRange,
  type DataTableCellRangeBounds,
  type DataTableCellRangeIndex
} from './data-table-cell-range';
import { isEditableCopyTarget } from './data-table-cell-selection-dom';
import { getCellCoordinate, getCoordinateKey, getEditableCellMeta } from './model';
import { activateDataTableCellSelectionOwner } from './data-table-cell-selection-owner';

function isPrintableCellKey(event: ReactKeyboardEvent<HTMLTableCellElement>): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && Array.from(event.key).length === 1;
}

function supportsPrintableDraft<TData>(
  editableCell: DataTableEditableColumnMeta<TData> | undefined
): boolean {
  return Boolean(
    editableCell && editableCell.editor !== 'choice' && editableCell.editor !== 'switch'
  );
}

function buildEmptyMatrixClipboard(rowCount: number, columnCount: number): string {
  const row = Array.from({ length: columnCount }, () => '').join('\t');
  return Array.from({ length: rowCount }, () => row).join('\n');
}

type RunAtomicMatrixInput = (options: {
  clipboardText: string;
  anchorRowIndex: number;
  anchorColumnIndex: number;
  requestedRange: DataTableCellRange;
  reason: 'paste' | 'delete';
}) => void;

export function useDataTableCellKeyboard<TData>({
  owner,
  range,
  rangeBounds,
  rangeIndex,
  cellsByCoordinate,
  pasteColumns,
  scrollViewportRef,
  editing,
  isCellEditable,
  startCellEditing,
  focusCoordinate,
  clearCellSelection,
  runAtomicMatrixInput,
  setRange
}: {
  owner: symbol;
  range: DataTableCellRange | null;
  rangeBounds: DataTableCellRangeBounds | null;
  rangeIndex: DataTableCellRangeIndex;
  cellsByCoordinate: ReadonlyMap<string, Cell<TData, unknown>>;
  pasteColumns: readonly Column<TData, unknown>[];
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  editing?: DataTableEditingRuntime<TData>;
  isCellEditable: (cell: Cell<TData, unknown>) => boolean;
  startCellEditing: (cell: Cell<TData, unknown>, initialDraft?: string) => number | null;
  focusCoordinate: (coordinate: DataTableCellCoordinate) => void;
  clearCellSelection: () => void;
  runAtomicMatrixInput: RunAtomicMatrixInput;
  setRange: Dispatch<SetStateAction<DataTableCellRange | null>>;
}) {
  return useCallback(
    (event: ReactKeyboardEvent<HTMLTableCellElement>, cell: Cell<TData, unknown>) => {
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        event.target !== event.currentTarget ||
        isEditableCopyTarget(event.target)
      ) {
        return;
      }
      if ((event.key === 'Enter' || event.key === 'F2') && isCellEditable(cell)) {
        event.preventDefault();
        event.stopPropagation();
        startCellEditing(cell);
        return;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        range &&
        rangeBounds
      ) {
        const anchorColumnId = rangeIndex.columnIds[rangeBounds.columnStart];
        const anchorColumnIndex = pasteColumns.findIndex((column) => column.id === anchorColumnId);
        if (anchorColumnIndex < 0) {
          toast.error(dataTableMessages.matrix.deleteTargetColumnUnavailable);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        runAtomicMatrixInput({
          clipboardText: buildEmptyMatrixClipboard(
            rangeBounds.rowEnd - rangeBounds.rowStart + 1,
            rangeBounds.columnEnd - rangeBounds.columnStart + 1
          ),
          anchorRowIndex: rangeBounds.rowStart,
          anchorColumnIndex,
          requestedRange: range,
          reason: 'delete'
        });
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        clearCellSelection();
        return;
      }
      const editableCell = getEditableCellMeta(cell);
      const isSingleCellRange =
        rangeBounds?.rowStart === rangeBounds?.rowEnd &&
        rangeBounds?.columnStart === rangeBounds?.columnEnd;
      if (
        isPrintableCellKey(event) &&
        isSingleCellRange &&
        supportsPrintableDraft(editableCell) &&
        isCellEditable(cell)
      ) {
        event.preventDefault();
        event.stopPropagation();
        startCellEditing(cell, event.key);
        return;
      }
      if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;

      const coordinate = getCellCoordinate(cell);
      const direction = getComputedStyle(
        scrollViewportRef.current ?? event.currentTarget
      ).direction;
      const next = moveDataTableCellCoordinate(
        coordinate,
        event.key as 'ArrowUp' | 'ArrowRight' | 'ArrowDown' | 'ArrowLeft',
        direction === 'rtl' ? 'rtl' : 'ltr',
        rangeIndex
      );
      event.preventDefault();
      const nextCell = cellsByCoordinate.get(getCoordinateKey(next));
      if (nextCell) {
        editing?.selectCell({
          rowId: nextCell.row.id,
          row: nextCell.row.original,
          columnId: nextCell.column.id
        });
      }
      activateDataTableCellSelectionOwner(owner);
      setRange((current) => ({
        anchor: event.shiftKey && current && rangeBounds ? current.anchor : next,
        focus: next
      }));
      focusCoordinate(next);
    },
    [
      cellsByCoordinate,
      clearCellSelection,
      editing,
      focusCoordinate,
      isCellEditable,
      owner,
      pasteColumns,
      range,
      rangeBounds,
      rangeIndex,
      runAtomicMatrixInput,
      scrollViewportRef,
      setRange,
      startCellEditing
    ]
  );
}
