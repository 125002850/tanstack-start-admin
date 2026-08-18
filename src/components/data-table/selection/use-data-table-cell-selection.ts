import type { Cell } from '@tanstack/react-table';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';

import type { DataTableFillBounds } from '../editing/batch/data-table-fill-plan';
import {
  getDataTableCellRangeEdges,
  isDataTableCellInRange,
  resolveDataTableCellRangeBounds,
  type DataTableCellRange,
  type DataTableCellRangeBounds
} from './data-table-cell-range';
import {
  canSelectDataTableCell,
  getCellCoordinate,
  getCoordinateKey,
  getEditableCellMeta,
  isSameCoordinate,
  useDataTableCellSelectionModel
} from './model';
import {
  activateDataTableCellSelectionOwner,
  clearDataTableCellSelectionOwner,
  releaseDataTableCellSelectionOwner,
  subscribeDataTableCellSelectionOwner
} from './data-table-cell-selection-owner';
import type { DataTableCellSelectionProps, UseDataTableCellSelectionOptions } from './types';
import { useDataTableCellBatchMutation } from './use-data-table-cell-batch-mutation';
import { useDataTableCellClipboard } from './use-data-table-cell-clipboard';
import { useDataTableCellFill } from './use-data-table-cell-fill';
import { useDataTableCellKeyboard } from './use-data-table-cell-keyboard';
import { useDataTableCellPointer } from './use-data-table-cell-pointer';

export type { DataTableCellFillHandleProps } from './types';

export function useDataTableCellSelection<TData>({
  rows,
  columns,
  matrixPasteColumns,
  scrollViewportRef,
  shouldIgnoreTarget,
  editing
}: UseDataTableCellSelectionOptions<TData>) {
  const ownerRef = useRef(Symbol('data-table-cell-selection'));
  const ownerId = useId();
  const rangeRef = useRef<DataTableCellRange | null>(null);
  const [range, setRange] = useState<DataTableCellRange | null>(null);
  rangeRef.current = range;

  const {
    pasteColumns,
    resolveColumnLabel,
    matrixPasteColumnContracts,
    rightPinnedColumnIds,
    rangeIndex,
    rangeBounds,
    cellsByCoordinate
  } = useDataTableCellSelectionModel({ rows, columns, matrixPasteColumns, range });

  const {
    beginPointerDrag,
    cellElementsRef,
    findCellAtPointer,
    finishPointerSelection,
    focusCoordinate,
    isFocusSelectionSuppressed,
    readCellCoordinate
  } = useDataTableCellPointer({
    ownerId,
    rangeIndex,
    cellsByCoordinate,
    scrollViewportRef,
    editing,
    setRange
  });

  const toPlanBounds = useCallback(
    (bounds: DataTableCellRangeBounds): DataTableFillBounds | null => {
      const startColumnId = rangeIndex.columnIds[bounds.columnStart];
      const endColumnId = rangeIndex.columnIds[bounds.columnEnd];
      const columnStart = pasteColumns.findIndex((column) => column.id === startColumnId);
      const columnEnd = pasteColumns.findIndex((column) => column.id === endColumnId);
      return columnStart >= 0 && columnEnd >= columnStart
        ? {
            rowStart: bounds.rowStart,
            rowEnd: bounds.rowEnd,
            columnStart,
            columnEnd
          }
        : null;
    },
    [pasteColumns, rangeIndex]
  );

  const isCellEditable = useCallback(
    (cell: Cell<TData, unknown>) =>
      Boolean(
        getEditableCellMeta(cell) &&
        editing?.isCellEditable({
          rowId: cell.row.id,
          row: cell.row.original,
          columnId: cell.column.id
        })
      ),
    [editing]
  );

  const selectedRangeIsFillable = useMemo(() => {
    if (!rangeBounds) return false;

    for (let rowIndex = rangeBounds.rowStart; rowIndex <= rangeBounds.rowEnd; rowIndex += 1) {
      const rowId = rangeIndex.rowIds[rowIndex];
      if (rowId === undefined) return false;

      for (
        let columnIndex = rangeBounds.columnStart;
        columnIndex <= rangeBounds.columnEnd;
        columnIndex += 1
      ) {
        const columnId = rangeIndex.columnIds[columnIndex];
        if (columnId === undefined) return false;
        const cell = cellsByCoordinate.get(getCoordinateKey({ rowId, columnId }));
        if (!cell || !isCellEditable(cell)) return false;
      }
    }

    return true;
  }, [cellsByCoordinate, isCellEditable, rangeBounds, rangeIndex]);

  const startCellEditing = useCallback(
    (cell: Cell<TData, unknown>, initialDraft?: string) => {
      const config = getEditableCellMeta(cell);
      if (!config || !editing || !isCellEditable(cell)) return null;
      const value = cell.getValue();
      if ('editor' in config && config.editor === 'switch') {
        editing.commitCandidate(
          {
            rowId: cell.row.id,
            row: cell.row.original,
            columnId: cell.column.id,
            field: config.field,
            editableCell: config,
            value: Object.is(value, config.checkedValue)
              ? config.uncheckedValue
              : config.checkedValue
          },
          'selection'
        );
        return null;
      }
      const sessionId = editing.startEditing({
        rowId: cell.row.id,
        row: cell.row.original,
        columnId: cell.column.id,
        field: config.field,
        initialValue: value,
        editableCell: config
      });
      if (sessionId !== null && initialDraft !== undefined) {
        editing.setActiveDraft(sessionId, initialDraft);
      }
      return sessionId;
    },
    [editing, isCellEditable]
  );

  const { runAtomicFill, runAtomicMatrixInput } = useDataTableCellBatchMutation({
    rows,
    matrixPasteColumnContracts,
    rightPinnedColumnIds,
    resolveColumnLabel,
    editing,
    range,
    rangeRef,
    rangeIndex,
    owner: ownerRef.current,
    setRange,
    focusCoordinate
  });

  const { clearCopyFeedback, copyFeedback } = useDataTableCellClipboard({
    owner: ownerRef.current,
    range,
    rangeBounds,
    rangeIndex,
    cellsByCoordinate,
    cellElementsRef,
    pasteColumns,
    editing,
    runAtomicMatrixInput
  });

  const { fillPreview, finishFillPointer, getCellFillHandleProps } = useDataTableCellFill({
    owner: ownerRef.current,
    range,
    rangeBounds,
    rangeIndex,
    selectedRangeIsFillable,
    scrollViewportRef,
    editing,
    findCellAtPointer,
    readCellCoordinate,
    toPlanBounds,
    finishPointerSelection,
    clearCopyFeedback,
    runAtomicFill
  });

  const clearCellSelection = useCallback(() => {
    finishPointerSelection();
    finishFillPointer();
    editing?.clearCellSelection();
    clearDataTableCellSelectionOwner();
    setRange(null);
    clearCopyFeedback();
  }, [clearCopyFeedback, editing, finishFillPointer, finishPointerSelection]);

  const beginPointerSelection = useCallback(
    (event: ReactPointerEvent<HTMLTableCellElement>, cell: Cell<TData, unknown>) => {
      if (event.button !== 0 || shouldIgnoreTarget?.(event.target, event.currentTarget)) return;
      if (!canSelectDataTableCell(cell)) {
        clearCellSelection();
        return;
      }

      const coordinate = getCellCoordinate(cell);
      editing?.selectCell({
        rowId: cell.row.id,
        row: cell.row.original,
        columnId: cell.column.id
      });
      const nextRange =
        event.shiftKey && range && rangeBounds
          ? { anchor: range.anchor, focus: coordinate }
          : { anchor: coordinate, focus: coordinate };

      finishPointerSelection();
      finishFillPointer();
      activateDataTableCellSelectionOwner(ownerRef.current);
      setRange(nextRange);
      clearCopyFeedback();
      beginPointerDrag(event);
    },
    [
      clearCellSelection,
      clearCopyFeedback,
      beginPointerDrag,
      editing,
      finishFillPointer,
      finishPointerSelection,
      range,
      rangeBounds,
      shouldIgnoreTarget
    ]
  );

  const handleCellFocus = useCallback(
    (event: React.FocusEvent<HTMLTableCellElement>, cell: Cell<TData, unknown>) => {
      if (
        isFocusSelectionSuppressed() ||
        event.target !== event.currentTarget ||
        !canSelectDataTableCell(cell)
      ) {
        return;
      }

      const coordinate = getCellCoordinate(cell);
      editing?.selectCell({
        rowId: cell.row.id,
        row: cell.row.original,
        columnId: cell.column.id
      });
      activateDataTableCellSelectionOwner(ownerRef.current);
      setRange((current) =>
        current?.focus && isSameCoordinate(current.focus, coordinate)
          ? current
          : { anchor: coordinate, focus: coordinate }
      );
      clearCopyFeedback();
    },
    [clearCopyFeedback, editing, isFocusSelectionSuppressed]
  );

  const handleCellKeyDown = useDataTableCellKeyboard({
    owner: ownerRef.current,
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
  });

  const copyFeedbackBounds = useMemo(
    () => (copyFeedback ? resolveDataTableCellRangeBounds(copyFeedback.range, rangeIndex) : null),
    [copyFeedback, rangeIndex]
  );
  const fillPreviewBounds = fillPreview?.targetBounds ?? null;
  const fillPreviewSourceBounds = fillPreview?.sourceBounds ?? null;

  const getCellSelectionProps = useCallback(
    (cell: Cell<TData, unknown>): DataTableCellSelectionProps => {
      const coordinate = getCellCoordinate(cell);
      const selectable = canSelectDataTableCell(cell);
      const selected =
        selectable && rangeBounds
          ? isDataTableCellInRange(coordinate, rangeBounds, rangeIndex)
          : false;
      const copied =
        selectable && copyFeedbackBounds
          ? isDataTableCellInRange(coordinate, copyFeedbackBounds, rangeIndex)
          : false;
      const fillPreviewed =
        selectable && fillPreviewBounds
          ? isDataTableCellInRange(coordinate, fillPreviewBounds, rangeIndex) &&
            !(fillPreviewSourceBounds
              ? isDataTableCellInRange(coordinate, fillPreviewSourceBounds, rangeIndex)
              : false)
          : false;
      const editableConfig = getEditableCellMeta(cell);
      const serverError = editableConfig
        ? editing?.getServerCellError?.(coordinate.rowId, editableConfig.field)
        : undefined;
      const serverErrorId = serverError
        ? `${ownerId}-server-error-${cell.id.replaceAll(':', '-')}`
        : undefined;
      const editable = isCellEditable(cell);
      const editingCell = editing?.activeCell;
      const readyCell = editing?.readyCell;
      const isEditing =
        editingCell?.rowId === coordinate.rowId && editingCell.columnId === coordinate.columnId;
      const isEditReady =
        editable &&
        !isEditing &&
        !(editableConfig && 'editor' in editableConfig && editableConfig.editor === 'switch') &&
        readyCell?.rowId === coordinate.rowId &&
        readyCell.columnId === coordinate.columnId;
      const isRangeFocus = Boolean(range?.focus && isSameCoordinate(coordinate, range.focus));
      const interactionState = isEditing
        ? 'editing'
        : isEditReady
          ? 'edit-ready'
          : isRangeFocus
            ? 'selected'
            : undefined;

      return {
        ref: (element) => {
          const key = getCoordinateKey(coordinate);
          if (element) cellElementsRef.current.set(key, element);
          else cellElementsRef.current.delete(key);
        },
        tabIndex: selectable && range?.focus && isSameCoordinate(coordinate, range.focus) ? 0 : -1,
        'data-cell-id': cell.id,
        'data-cell-row-id': coordinate.rowId,
        'data-cell-column-id': coordinate.columnId,
        'data-cell-selection-owner': ownerId,
        'data-cell-copy-flash': copied ? 'true' : undefined,
        'data-cell-copy-flash-run': copied ? copyFeedback?.run : undefined,
        'data-cell-fill-preview': fillPreviewed ? 'true' : undefined,
        'data-cell-server-invalid': serverError ? 'true' : undefined,
        'data-cell-selected': selected ? 'true' : undefined,
        'data-cell-range-anchor':
          selectable && range?.anchor && isSameCoordinate(coordinate, range.anchor)
            ? 'true'
            : undefined,
        'data-cell-range-focus':
          selectable && range?.focus && isSameCoordinate(coordinate, range.focus)
            ? 'true'
            : undefined,
        'data-cell-range-edge':
          selectable && rangeBounds
            ? getDataTableCellRangeEdges(coordinate, rangeBounds, rangeIndex)
            : undefined,
        'data-cell-editable': editable ? 'true' : undefined,
        'data-cell-edit-ready': isEditReady ? 'true' : undefined,
        'data-cell-editing': isEditing ? 'true' : undefined,
        'data-cell-interaction-state': interactionState,
        'aria-invalid': serverError ? true : undefined,
        'aria-describedby': serverErrorId,
        onFocus: (event) => handleCellFocus(event, cell),
        onPointerDown: (event) => beginPointerSelection(event, cell),
        onDoubleClick: (event) => {
          if (!editable || shouldIgnoreTarget?.(event.target, event.currentTarget)) return;
          event.preventDefault();
          event.stopPropagation();
          startCellEditing(cell);
        },
        onKeyDown: (event) => handleCellKeyDown(event, cell)
      };
    },
    [
      beginPointerSelection,
      cellElementsRef,
      copyFeedback?.run,
      copyFeedbackBounds,
      editing,
      fillPreviewBounds,
      fillPreviewSourceBounds,
      handleCellFocus,
      handleCellKeyDown,
      isCellEditable,
      ownerId,
      range,
      rangeBounds,
      rangeIndex,
      shouldIgnoreTarget,
      startCellEditing
    ]
  );

  const getCellServerError = useCallback(
    (cell: Cell<TData, unknown>) => {
      const editableConfig = getEditableCellMeta(cell);
      const error = editableConfig
        ? editing?.getServerCellError?.(cell.row.id, editableConfig.field)
        : undefined;
      return error
        ? {
            error,
            id: `${ownerId}-server-error-${cell.id.replaceAll(':', '-')}`
          }
        : null;
    },
    [editing, ownerId]
  );

  useEffect(() => {
    if (range && !rangeBounds) clearCellSelection();
  }, [clearCellSelection, range, rangeBounds]);

  useEffect(
    () =>
      subscribeDataTableCellSelectionOwner((owner) => {
        if (owner !== ownerRef.current) {
          finishPointerSelection();
          finishFillPointer();
          editing?.clearCellSelection();
          setRange(null);
          clearCopyFeedback();
        }
      }),
    [clearCopyFeedback, editing, finishFillPointer, finishPointerSelection]
  );

  useEffect(() => {
    const handleWindowBlur = () => {
      finishPointerSelection();
      finishFillPointer();
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [finishFillPointer, finishPointerSelection]);

  useEffect(() => {
    const owner = ownerRef.current;
    return () => {
      finishPointerSelection();
      finishFillPointer();
      releaseDataTableCellSelectionOwner(owner);
    };
  }, [finishFillPointer, finishPointerSelection]);

  return { getCellFillHandleProps, getCellSelectionProps, getCellServerError };
}
