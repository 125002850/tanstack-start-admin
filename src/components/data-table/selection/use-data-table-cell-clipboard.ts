import type { Cell, Column } from '@tanstack/react-table';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { toast } from 'sonner';

import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableEditingRuntime } from '../editing/types';
import {
  buildDataTableCellRangeTsv,
  normalizeDataTableCellClipboardText,
  resolveDataTableCellClipboardText,
  type DataTableCellRange,
  type DataTableCellRangeBounds,
  type DataTableCellRangeIndex
} from './data-table-cell-range';
import { hasUserTextSelection, isEditableCopyTarget } from './data-table-cell-selection-dom';
import { getCoordinateKey, getEditableCellMeta } from './model';
import { isDataTableCellSelectionOwnerActive } from './data-table-cell-selection-owner';
import type { DataTableCellCopyFeedbackState } from './types';

const DATA_TABLE_CELL_COPY_FEEDBACK_DURATION_MS = 960;

type RunAtomicMatrixInput = (options: {
  clipboardText: string;
  anchorRowIndex: number;
  anchorColumnIndex: number;
  requestedRange: DataTableCellRange;
  reason: 'paste' | 'delete';
}) => void;

export function useDataTableCellClipboard<TData>({
  owner,
  range,
  rangeBounds,
  rangeIndex,
  cellsByCoordinate,
  cellElementsRef,
  pasteColumns,
  editing,
  runAtomicMatrixInput
}: {
  owner: symbol;
  range: DataTableCellRange | null;
  rangeBounds: DataTableCellRangeBounds | null;
  rangeIndex: DataTableCellRangeIndex;
  cellsByCoordinate: ReadonlyMap<string, Cell<TData, unknown>>;
  cellElementsRef: RefObject<Map<string, HTMLTableCellElement>>;
  pasteColumns: readonly Column<TData, unknown>[];
  editing?: DataTableEditingRuntime<TData>;
  runAtomicMatrixInput: RunAtomicMatrixInput;
}) {
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const nextCopyFeedbackRunRef = useRef<DataTableCellCopyFeedbackState['run']>('a');
  const [copyFeedback, setCopyFeedback] = useState<DataTableCellCopyFeedbackState | null>(null);

  const clearCopyFeedbackTimeout = useCallback(() => {
    if (copyFeedbackTimeoutRef.current === null) return;
    window.clearTimeout(copyFeedbackTimeoutRef.current);
    copyFeedbackTimeoutRef.current = null;
  }, []);

  const clearCopyFeedback = useCallback(() => setCopyFeedback(null), []);

  const flashCopiedRange = useCallback(
    (copiedRange: DataTableCellRange) => {
      clearCopyFeedbackTimeout();
      const run = nextCopyFeedbackRunRef.current;
      nextCopyFeedbackRunRef.current = run === 'a' ? 'b' : 'a';
      setCopyFeedback({ range: copiedRange, run });
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        copyFeedbackTimeoutRef.current = null;
        setCopyFeedback(null);
      }, DATA_TABLE_CELL_COPY_FEEDBACK_DURATION_MS);
    },
    [clearCopyFeedbackTimeout]
  );

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (
        !isDataTableCellSelectionOwnerActive(owner) ||
        !range ||
        !rangeBounds ||
        isEditableCopyTarget(event.target) ||
        hasUserTextSelection() ||
        !event.clipboardData
      ) {
        return;
      }

      const text = buildDataTableCellRangeTsv(rangeBounds, rangeIndex, (coordinate) => {
        const key = getCoordinateKey(coordinate);
        const cell = cellsByCoordinate.get(key);
        if (!cell) return '';
        const copyValue = cell.column.columnDef.meta?.copyValue;
        if (copyValue) {
          return normalizeDataTableCellClipboardText(copyValue(cell.getValue(), cell.row.original));
        }
        const cellElement = cellElementsRef.current.get(key);
        const renderedText = cellElement
          ? typeof cellElement.innerText === 'string'
            ? cellElement.innerText
            : (cellElement.textContent ?? '')
          : undefined;
        return resolveDataTableCellClipboardText({
          renderedText,
          rawValue: cell.getValue()
        });
      });

      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
      flashCopiedRange(range);
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [cellsByCoordinate, cellElementsRef, flashCopiedRange, owner, range, rangeBounds, rangeIndex]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (
        !isDataTableCellSelectionOwnerActive(owner) ||
        !range ||
        !rangeBounds ||
        isEditableCopyTarget(event.target) ||
        hasUserTextSelection() ||
        !event.clipboardData
      ) {
        return;
      }

      event.preventDefault();
      const isSingleCell =
        rangeBounds.rowStart === rangeBounds.rowEnd &&
        rangeBounds.columnStart === rangeBounds.columnEnd;
      const rawDraft = event.clipboardData.getData('text/plain');
      const isMatrixClipboard = /[\t\r\n]/.test(rawDraft);
      if (isMatrixClipboard) {
        const anchorColumnId = rangeIndex.columnIds[rangeBounds.columnStart];
        const anchorColumnIndex = pasteColumns.findIndex((column) => column.id === anchorColumnId);
        if (anchorColumnIndex < 0) {
          toast.error(dataTableMessages.matrix.pasteTargetColumnUnavailable);
          return;
        }
        runAtomicMatrixInput({
          clipboardText: rawDraft,
          anchorRowIndex: rangeBounds.rowStart,
          anchorColumnIndex,
          requestedRange: range,
          reason: 'paste'
        });
        return;
      }

      if (!isSingleCell) return;
      const rowId = rangeIndex.rowIds[rangeBounds.rowStart];
      const columnId = rangeIndex.columnIds[rangeBounds.columnStart];
      if (rowId === undefined || columnId === undefined) return;

      const cell = cellsByCoordinate.get(getCoordinateKey({ rowId, columnId }));
      const editableCell = cell ? getEditableCellMeta(cell) : undefined;
      if (!cell || !editableCell || !editing) return;

      editing.commitInput(
        {
          rowId: cell.row.id,
          row: cell.row.original,
          columnId: cell.column.id,
          field: editableCell.field,
          editableCell,
          input: {
            kind: 'raw-draft',
            value: rawDraft
          }
        },
        'paste'
      );
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [
    cellsByCoordinate,
    editing,
    owner,
    pasteColumns,
    range,
    rangeBounds,
    rangeIndex,
    runAtomicMatrixInput
  ]);

  useEffect(() => clearCopyFeedbackTimeout, [clearCopyFeedbackTimeout]);

  return { clearCopyFeedback, copyFeedback };
}
