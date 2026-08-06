import { type Cell, type Column, type Row } from '@tanstack/react-table';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
  type RefObject
} from 'react';
import { toast } from 'sonner';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID
} from '@/hooks/use-data-table/constants';
import { dataTableMessages } from '@/config/data-table-messages';
import {
  buildDataTableCellRangeTsv,
  createDataTableCellRangeIndex,
  getDataTableCellRangeEdges,
  isDataTableCellInRange,
  moveDataTableCellCoordinate,
  normalizeDataTableCellClipboardText,
  resolveDataTableCellClipboardText,
  resolveDataTableCellRangeBounds,
  type DataTableCellCoordinate,
  type DataTableCellRange,
  type DataTableCellRangeBounds
} from './data-table-cell-range';
import {
  prepareDataTableFillPlan,
  resolveDataTableFillTarget,
  type DataTableFillBounds,
  type DataTableFillTarget
} from './data-table-fill-plan';
import {
  prepareDataTableMatrixPaste,
  type DataTableMatrixPasteFailure
} from './data-table-matrix-paste';
import { useDataTableCellAutoScroll } from './use-data-table-cell-auto-scroll';
import type { DataTableEditableColumnMeta, DataTableEditingRuntime } from '@/types/data-table';

const DATA_TABLE_CELL_SELECTION_CHANGE_EVENT = 'data-table-cell-selection-change';
const DATA_TABLE_CELL_COPY_FEEDBACK_DURATION_MS = 960;

type DataTableCellSelectionChangeDetail = {
  owner: symbol | null;
};

type DataTableCellCopyFeedbackState = {
  range: DataTableCellRange;
  run: 'a' | 'b';
};

type DataTableCellSelectionProps = {
  ref: RefCallback<HTMLTableCellElement>;
  tabIndex: number;
  'data-cell-id': string;
  'data-cell-row-id': string;
  'data-cell-column-id': string;
  'data-cell-selection-owner': string;
  'data-cell-copy-flash'?: 'true';
  'data-cell-copy-flash-run'?: DataTableCellCopyFeedbackState['run'];
  'data-cell-fill-preview'?: 'true';
  'data-cell-server-invalid'?: 'true';
  'data-cell-selected'?: 'true';
  'data-cell-range-anchor'?: 'true';
  'data-cell-range-focus'?: 'true';
  'data-cell-range-edge'?: string;
  'data-cell-editable'?: 'true';
  'data-cell-edit-ready'?: 'true';
  'data-cell-editing'?: 'true';
  'data-cell-interaction-state'?: 'selected' | 'edit-ready' | 'editing';
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  onFocus: (event: React.FocusEvent<HTMLTableCellElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLTableCellElement>) => void;
  onDoubleClick: (event: React.MouseEvent<HTMLTableCellElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTableCellElement>) => void;
};

export type DataTableCellFillHandleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'data-slot': 'data-table-cell-fill-handle';
};

type UseDataTableCellSelectionOptions<TData> = {
  rows: readonly Row<TData>[];
  columns: readonly Column<TData, unknown>[];
  matrixPasteColumns?: readonly Column<TData, unknown>[];
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  shouldIgnoreTarget?: (target: EventTarget | null, currentTarget: HTMLElement) => boolean;
  editing?: DataTableEditingRuntime<TData>;
};

type ActivePointerSelection = {
  pointerId: number;
  handlePointerMove: (event: PointerEvent) => void;
  captureTarget: HTMLElement;
};

type DataTableFillPreviewState = DataTableFillTarget & {
  readonly sourceRange: DataTableCellRange;
  readonly sourceBounds: DataTableCellRangeBounds;
  readonly planSourceBounds: DataTableFillBounds;
  readonly planTargetBounds: DataTableFillBounds;
};

type ActiveFillPointer = {
  pointerId: number;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerEnd: (event: PointerEvent) => void;
  captureTarget: HTMLButtonElement;
  sourceRange: DataTableCellRange;
  sourceBounds: DataTableCellRangeBounds;
  planSourceBounds: DataTableFillBounds;
};

let activeCellSelectionOwner: symbol | null = null;

function emitDataTableCellSelectionChange(owner: symbol | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DataTableCellSelectionChangeDetail>(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, {
      detail: { owner }
    })
  );
}

function canSelectDataTableColumn<TData>(column: Column<TData, unknown>): boolean {
  return (
    column.id !== DATA_TABLE_ROW_NUMBER_COLUMN_ID &&
    column.id !== DATA_TABLE_ACTIONS_COLUMN_ID &&
    !column.getIsPinned()
  );
}

function canSelectDataTableCell<TData>(cell: Cell<TData, unknown>): boolean {
  return canSelectDataTableColumn(cell.column);
}

function hasUserTextSelection(): boolean {
  const selection = document.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0);
}

function isEditableCopyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select')) return true;

  let element: HTMLElement | null = target;
  while (element) {
    if (element.isContentEditable || element.getAttribute('contenteditable') !== null) return true;
    element = element.parentElement;
  }
  return false;
}

function getCoordinateKey({ rowId, columnId }: DataTableCellCoordinate) {
  return `${rowId}\u0000${columnId}`;
}

function getCellCoordinate<TData>(cell: Cell<TData, unknown>): DataTableCellCoordinate {
  return { rowId: cell.row.id, columnId: cell.column.id };
}

function getEditableCellMeta<TData>(
  cell: Cell<TData, unknown>
): DataTableEditableColumnMeta<TData> | undefined {
  return getEditableColumnMeta(cell.column);
}

function getEditableColumnMeta<TData>(
  column: Column<TData, unknown>
): DataTableEditableColumnMeta<TData> | undefined {
  return column.columnDef.meta?.editableCell ?? column.columnDef.meta?.editableChoice;
}

function isSameCoordinate(left: DataTableCellCoordinate, right: DataTableCellCoordinate): boolean {
  return left.rowId === right.rowId && left.columnId === right.columnId;
}

function isSameRange(left: DataTableCellRange | null, right: DataTableCellRange | null): boolean {
  return Boolean(
    left &&
    right &&
    isSameCoordinate(left.anchor, right.anchor) &&
    isSameCoordinate(left.focus, right.focus)
  );
}

function formatMatrixPasteFailure(
  failure: DataTableMatrixPasteFailure,
  resolveColumnLabel: (columnId: string) => string
): {
  message: string;
  description?: string;
} {
  const source = failure.source
    ? dataTableMessages.matrix.sourceCoordinate(
        failure.source.rowIndex + 1,
        failure.source.columnIndex + 1,
        failure.source.columnId ? resolveColumnLabel(failure.source.columnId) : undefined
      )
    : undefined;
  const target = failure.target
    ? dataTableMessages.matrix.targetCoordinate(
        failure.target.rowIndex + 1,
        failure.target.columnIndex + 1,
        failure.target.columnId ? resolveColumnLabel(failure.target.columnId) : undefined
      )
    : undefined;
  const coordinates = [source, target].filter(Boolean).join(' → ');
  return {
    message: failure.errors[0] ?? dataTableMessages.matrix.failed,
    ...(coordinates ? { description: coordinates } : {})
  };
}

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

function createRangeFromBounds(
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

function unionRangeBounds(
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
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const nextCopyFeedbackRunRef = useRef<DataTableCellCopyFeedbackState['run']>('a');
  const activePointerRef = useRef<ActivePointerSelection | null>(null);
  const activeFillPointerRef = useRef<ActiveFillPointer | null>(null);
  const suppressNextFocusSelectionRef = useRef(false);
  const stopAutoScrollRef = useRef<() => void>(() => undefined);
  const matrixPasteAbortRef = useRef<AbortController | null>(null);
  const pasteRequestSequenceRef = useRef(0);
  const rangeRef = useRef<DataTableCellRange | null>(null);
  const fillPreviewRef = useRef<DataTableFillPreviewState | null>(null);
  const cellElementsRef = useRef(new Map<string, HTMLTableCellElement>());
  const [range, setRange] = useState<DataTableCellRange | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<DataTableCellCopyFeedbackState | null>(null);
  const [fillPreview, setFillPreview] = useState<DataTableFillPreviewState | null>(null);
  rangeRef.current = range;
  fillPreviewRef.current = fillPreview;

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
  const copyFeedbackBounds = useMemo(
    () => (copyFeedback ? resolveDataTableCellRangeBounds(copyFeedback.range, rangeIndex) : null),
    [copyFeedback, rangeIndex]
  );
  const fillPreviewBounds = fillPreview?.targetBounds ?? null;
  const fillPreviewSourceBounds = fillPreview?.sourceBounds ?? null;
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

  const clearCopyFeedbackTimeout = useCallback(() => {
    if (copyFeedbackTimeoutRef.current === null) return;
    window.clearTimeout(copyFeedbackTimeoutRef.current);
    copyFeedbackTimeoutRef.current = null;
  }, []);

  const finishPointerSelection = useCallback(() => {
    stopAutoScrollRef.current();
    scrollViewportRef.current?.removeAttribute('data-cell-range-dragging');
    const activePointer = activePointerRef.current;
    if (activePointer) {
      document.removeEventListener('pointermove', activePointer.handlePointerMove);
      if (activePointer.captureTarget.hasPointerCapture?.(activePointer.pointerId)) {
        activePointer.captureTarget.releasePointerCapture(activePointer.pointerId);
      }
    }
    activePointerRef.current = null;
    document.removeEventListener('pointerup', finishPointerSelection);
    document.removeEventListener('pointercancel', finishPointerSelection);
  }, [scrollViewportRef]);

  const finishFillPointer = useCallback(() => {
    stopAutoScrollRef.current();
    scrollViewportRef.current?.removeAttribute('data-cell-fill-dragging');
    const activePointer = activeFillPointerRef.current;
    if (activePointer) {
      document.removeEventListener('pointermove', activePointer.handlePointerMove);
      document.removeEventListener('pointerup', activePointer.handlePointerEnd);
      document.removeEventListener('pointercancel', activePointer.handlePointerEnd);
      if (activePointer.captureTarget.hasPointerCapture?.(activePointer.pointerId)) {
        activePointer.captureTarget.releasePointerCapture(activePointer.pointerId);
      }
    }
    activeFillPointerRef.current = null;
    setFillPreview(null);
  }, [scrollViewportRef]);

  const clearCellSelection = useCallback(() => {
    finishPointerSelection();
    finishFillPointer();
    editing?.clearCellSelection();
    activeCellSelectionOwner = null;
    emitDataTableCellSelectionChange(null);
    setRange(null);
    setCopyFeedback(null);
  }, [editing, finishFillPointer, finishPointerSelection]);

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

  const findOwnedCell = useCallback(
    (element: Element | null): HTMLTableCellElement | null => {
      const cell = element?.closest<HTMLTableCellElement>('[data-cell-id]') ?? null;
      return cell?.dataset.cellSelectionOwner === ownerId ? cell : null;
    },
    [ownerId]
  );

  const findCellAtPointer = useCallback(
    ({
      clientX,
      clientY,
      target
    }: {
      clientX: number;
      clientY: number;
      target?: EventTarget | null;
    }): HTMLTableCellElement | null => {
      const stackedElements = document.elementsFromPoint?.(clientX, clientY) ?? [];
      for (const element of stackedElements) {
        const cell = findOwnedCell(element);
        if (cell) return cell;
      }

      const isCaptured =
        (activePointerRef.current !== null &&
          activePointerRef.current.captureTarget.hasPointerCapture?.(
            activePointerRef.current.pointerId
          )) ||
        (activeFillPointerRef.current !== null &&
          activeFillPointerRef.current.captureTarget.hasPointerCapture?.(
            activeFillPointerRef.current.pointerId
          ));

      const targetCell = findOwnedCell(target instanceof Element ? target : null);
      if (targetCell && !isCaptured) return targetCell;

      const candidates = Array.from(cellElementsRef.current.values());
      let nearest: HTMLTableCellElement | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of candidates) {
        const rect = candidate.getBoundingClientRect();
        const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
        const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
        const distance = dx * dx + dy * dy;
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      return nearest;
    },
    [findOwnedCell]
  );

  const readCellCoordinate = useCallback(
    (cell: HTMLTableCellElement): DataTableCellCoordinate | null => {
      const rowId = cell.dataset.cellRowId;
      const columnId = cell.dataset.cellColumnId;
      if (!rowId || !columnId) return null;
      return rangeIndex.rowIndexById.has(rowId) && rangeIndex.columnIndexById.has(columnId)
        ? { rowId, columnId }
        : null;
    },
    [rangeIndex]
  );

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

  const updateRangeFocusAtPointer = useCallback(
    (pointer: { clientX: number; clientY: number; target?: EventTarget | null }) => {
      const cell = findCellAtPointer(pointer);
      const coordinate = cell ? readCellCoordinate(cell) : null;
      if (coordinate) {
        const dataCell = cellsByCoordinate.get(getCoordinateKey(coordinate));
        if (dataCell) {
          editing?.selectCell({
            rowId: dataCell.row.id,
            row: dataCell.row.original,
            columnId: dataCell.column.id
          });
        }
        setRange((current) =>
          current && !isSameCoordinate(current.focus, coordinate)
            ? { ...current, focus: coordinate }
            : current
        );
      }
      return cell;
    },
    [cellsByCoordinate, editing, findCellAtPointer, readCellCoordinate]
  );

  const updateFillPreviewAtPointer = useCallback(
    (pointer: { clientX: number; clientY: number; target?: EventTarget | null }) => {
      const activeFill = activeFillPointerRef.current;
      if (!activeFill) return null;
      const cell = findCellAtPointer(pointer);
      const coordinate = cell ? readCellCoordinate(cell) : null;
      const rowIndex = coordinate ? rangeIndex.rowIndexById.get(coordinate.rowId) : undefined;
      const columnIndex = coordinate
        ? rangeIndex.columnIndexById.get(coordinate.columnId)
        : undefined;
      if (rowIndex === undefined || columnIndex === undefined) {
        setFillPreview(null);
        return cell;
      }
      const target = resolveDataTableFillTarget(activeFill.sourceBounds, {
        rowIndex,
        columnIndex
      });
      const planTargetBounds = target ? toPlanBounds(target.targetBounds) : null;
      setFillPreview(
        target && planTargetBounds
          ? {
              ...target,
              sourceRange: activeFill.sourceRange,
              sourceBounds: activeFill.sourceBounds,
              planSourceBounds: activeFill.planSourceBounds,
              planTargetBounds
            }
          : null
      );
      return cell;
    },
    [findCellAtPointer, rangeIndex, readCellCoordinate, toPlanBounds]
  );

  const { stop: stopAutoScroll, updatePointer: updateAutoScrollPointer } =
    useDataTableCellAutoScroll({
      viewportRef: scrollViewportRef,
      onScrollFrame: (pointer) => {
        if (activeFillPointerRef.current) updateFillPreviewAtPointer(pointer);
        else updateRangeFocusAtPointer(pointer);
      }
    });
  stopAutoScrollRef.current = stopAutoScroll;

  const handleDocumentPointerMove = useCallback(
    (event: PointerEvent) => {
      if (event.pointerId !== activePointerRef.current?.pointerId) return;
      const cell = updateRangeFocusAtPointer(event);
      if (!cell) return;
      event.preventDefault();
      updateAutoScrollPointer({
        clientX: event.clientX,
        clientY: event.clientY,
        cellSize: cell.getBoundingClientRect().height || 40
      });
    },
    [updateAutoScrollPointer, updateRangeFocusAtPointer]
  );

  const handleDocumentFillPointerMove = useCallback(
    (event: PointerEvent) => {
      if (event.pointerId !== activeFillPointerRef.current?.pointerId) return;
      const cell = updateFillPreviewAtPointer(event);
      if (!cell) return;
      event.preventDefault();
      updateAutoScrollPointer({
        clientX: event.clientX,
        clientY: event.clientY,
        cellSize: cell.getBoundingClientRect().height || 40
      });
    },
    [updateAutoScrollPointer, updateFillPreviewAtPointer]
  );

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
      activeCellSelectionOwner = ownerRef.current;
      emitDataTableCellSelectionChange(ownerRef.current);
      setRange(nextRange);
      setCopyFeedback(null);
      suppressNextFocusSelectionRef.current = true;
      event.currentTarget.focus({ preventScroll: true });
      suppressNextFocusSelectionRef.current = false;
      event.preventDefault();
      scrollViewportRef.current?.setAttribute('data-cell-range-dragging', 'true');
      event.currentTarget.setPointerCapture?.(event.pointerId);

      activePointerRef.current = {
        pointerId: event.pointerId,
        handlePointerMove: handleDocumentPointerMove,
        captureTarget: event.currentTarget
      };
      document.addEventListener('pointermove', handleDocumentPointerMove);
      document.addEventListener('pointerup', finishPointerSelection);
      document.addEventListener('pointercancel', finishPointerSelection);
    },
    [
      clearCellSelection,
      editing,
      finishPointerSelection,
      handleDocumentPointerMove,
      range,
      rangeBounds,
      shouldIgnoreTarget,
      scrollViewportRef
    ]
  );

  const focusCoordinate = useCallback((coordinate: DataTableCellCoordinate) => {
    suppressNextFocusSelectionRef.current = true;
    cellElementsRef.current.get(getCoordinateKey(coordinate))?.focus({ preventScroll: true });
    suppressNextFocusSelectionRef.current = false;
  }, []);

  const handleCellFocus = useCallback(
    (event: React.FocusEvent<HTMLTableCellElement>, cell: Cell<TData, unknown>) => {
      if (
        suppressNextFocusSelectionRef.current ||
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
      activeCellSelectionOwner = ownerRef.current;
      emitDataTableCellSelectionChange(ownerRef.current);
      setRange((current) =>
        current?.focus && isSameCoordinate(current.focus, coordinate)
          ? current
          : { anchor: coordinate, focus: coordinate }
      );
      setCopyFeedback(null);
    },
    [editing]
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

  const runAtomicMatrixInput = useCallback(
    ({
      clipboardText,
      anchorRowIndex,
      anchorColumnIndex,
      requestedRange,
      reason
    }: {
      clipboardText: string;
      anchorRowIndex: number;
      anchorColumnIndex: number;
      requestedRange: DataTableCellRange;
      reason: 'paste' | 'delete';
    }) => {
      if (!editing || editing.activeCell) {
        toast.error(
          editing
            ? dataTableMessages.matrix.finishActiveEdit
            : dataTableMessages.matrix.editableTableRequired
        );
        return;
      }

      matrixPasteAbortRef.current?.abort();
      const abortController = new AbortController();
      matrixPasteAbortRef.current = abortController;
      pasteRequestSequenceRef.current += 1;
      const requestSequence = pasteRequestSequenceRef.current;
      const revision = editing.getRevision();

      void prepareDataTableMatrixPaste({
        clipboardText,
        rows: rows.map((row) => ({ rowId: row.id, row: row.original })),
        columns: matrixPasteColumnContracts,
        rightPinnedColumnIds,
        anchor: {
          rowIndex: anchorRowIndex,
          columnIndex: anchorColumnIndex
        },
        revision,
        isCellEditable: editing.isCellEditable,
        signal: abortController.signal
      })
        .then((plan) => {
          if (
            requestSequence !== pasteRequestSequenceRef.current ||
            abortController.signal.aborted ||
            activeCellSelectionOwner !== ownerRef.current ||
            !isSameRange(requestedRange, rangeRef.current)
          ) {
            return;
          }
          matrixPasteAbortRef.current = null;

          if (plan.status === 'invalid') {
            const failure = plan.failures[0];
            if (!failure || failure.code === 'aborted') return;
            const feedback = formatMatrixPasteFailure(failure, resolveColumnLabel);
            toast.error(
              feedback.message,
              feedback.description ? { description: feedback.description } : undefined
            );
            return;
          }

          const result = editing.applyBatch(
            {
              revision: plan.revision,
              commits: plan.operations.map((operation) => ({
                rowId: operation.target.rowId,
                columnId: operation.target.columnId,
                field: operation.field,
                value: operation.value,
                editableCell: operation.editableCell
              }))
            },
            reason
          );
          if (result.status === 'blocked') {
            toast.error(result.errors[0] ?? dataTableMessages.matrix.editFailed);
          }
        })
        .catch((error: unknown) => {
          if (
            requestSequence !== pasteRequestSequenceRef.current ||
            abortController.signal.aborted
          ) {
            return;
          }
          matrixPasteAbortRef.current = null;
          toast.error(
            error instanceof Error ? error.message : dataTableMessages.matrix.preparationFailed
          );
        });
    },
    [editing, matrixPasteColumnContracts, resolveColumnLabel, rightPinnedColumnIds, rows]
  );

  const runAtomicFill = useCallback(
    (preview: DataTableFillPreviewState) => {
      if (!editing || editing.activeCell) {
        toast.error(
          editing
            ? dataTableMessages.fill.finishActiveEdit
            : dataTableMessages.fill.editableTableRequired
        );
        return;
      }

      matrixPasteAbortRef.current?.abort();
      const abortController = new AbortController();
      matrixPasteAbortRef.current = abortController;
      pasteRequestSequenceRef.current += 1;
      const requestSequence = pasteRequestSequenceRef.current;
      const revision = editing.getRevision();

      void prepareDataTableFillPlan({
        rows: rows.map((row) => ({ rowId: row.id, row: row.original })),
        columns: matrixPasteColumnContracts,
        rightPinnedColumnIds,
        sourceBounds: preview.planSourceBounds,
        targetBounds: preview.planTargetBounds,
        revision,
        isCellEditable: editing.isCellEditable,
        signal: abortController.signal
      })
        .then((plan) => {
          if (
            requestSequence !== pasteRequestSequenceRef.current ||
            abortController.signal.aborted ||
            activeCellSelectionOwner !== ownerRef.current ||
            !isSameRange(preview.sourceRange, rangeRef.current)
          ) {
            return;
          }
          matrixPasteAbortRef.current = null;

          if (plan.status === 'invalid') {
            const failure = plan.failures[0];
            if (!failure || failure.code === 'aborted') return;
            const feedback = formatMatrixPasteFailure(failure, resolveColumnLabel);
            toast.error(
              feedback.message,
              feedback.description ? { description: feedback.description } : undefined
            );
            return;
          }

          const result = editing.applyBatch(
            {
              revision: plan.revision,
              commits: plan.operations.map((operation) => ({
                rowId: operation.target.rowId,
                columnId: operation.target.columnId,
                field: operation.field,
                value: operation.value,
                editableCell: operation.editableCell
              }))
            },
            'fill'
          );
          if (result.status === 'blocked') {
            toast.error(result.errors[0] ?? dataTableMessages.fill.failed);
            return;
          }

          const nextRange = createRangeFromBounds(
            unionRangeBounds(preview.sourceBounds, preview.targetBounds),
            rangeIndex.rowIds,
            rangeIndex.columnIds
          );
          if (nextRange) {
            setRange(nextRange);
            focusCoordinate(nextRange.focus);
          }
        })
        .catch((error: unknown) => {
          if (
            requestSequence !== pasteRequestSequenceRef.current ||
            abortController.signal.aborted
          ) {
            return;
          }
          matrixPasteAbortRef.current = null;
          toast.error(
            error instanceof Error ? error.message : dataTableMessages.fill.preparationFailed
          );
        });
    },
    [editing, focusCoordinate, matrixPasteColumnContracts, rangeIndex, resolveColumnLabel, rightPinnedColumnIds, rows]
  );

  const handleDocumentFillPointerEnd = useCallback(
    (event: PointerEvent) => {
      const activeFill = activeFillPointerRef.current;
      if (!activeFill || event.pointerId !== activeFill.pointerId) return;
      const preview = fillPreviewRef.current;
      finishFillPointer();
      if (preview) runAtomicFill(preview);
    },
    [finishFillPointer, runAtomicFill]
  );

  const beginFillPointer = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (
        event.button !== 0 ||
        !selectedRangeIsFillable ||
        !range ||
        !rangeBounds ||
        editing?.activeCell ||
        activeCellSelectionOwner !== ownerRef.current
      ) {
        return;
      }
      const planSourceBounds = toPlanBounds(rangeBounds);
      if (!planSourceBounds) {
        toast.error(dataTableMessages.fill.sourceColumnsUnavailable);
        return;
      }

      finishPointerSelection();
      finishFillPointer();
      setCopyFeedback(null);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      scrollViewportRef.current?.setAttribute('data-cell-fill-dragging', 'true');

      activeFillPointerRef.current = {
        pointerId: event.pointerId,
        handlePointerMove: handleDocumentFillPointerMove,
        handlePointerEnd: handleDocumentFillPointerEnd,
        captureTarget: event.currentTarget,
        sourceRange: range,
        sourceBounds: rangeBounds,
        planSourceBounds
      };
      document.addEventListener('pointermove', handleDocumentFillPointerMove);
      document.addEventListener('pointerup', handleDocumentFillPointerEnd);
      document.addEventListener('pointercancel', handleDocumentFillPointerEnd);
    },
    [
      editing?.activeCell,
      finishFillPointer,
      finishPointerSelection,
      handleDocumentFillPointerEnd,
      handleDocumentFillPointerMove,
      range,
      rangeBounds,
      selectedRangeIsFillable,
      scrollViewportRef,
      toPlanBounds
    ]
  );

  const fillWithKeyboard = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (
        !selectedRangeIsFillable ||
        !range ||
        !rangeBounds ||
        !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const rowCount = rangeBounds.rowEnd - rangeBounds.rowStart + 1;
      const columnCount = rangeBounds.columnEnd - rangeBounds.columnStart + 1;
      const direction = getComputedStyle(
        scrollViewportRef.current ?? event.currentTarget
      ).direction;
      const logicalKey =
        direction === 'rtl' && event.key === 'ArrowLeft'
          ? 'ArrowRight'
          : direction === 'rtl' && event.key === 'ArrowRight'
            ? 'ArrowLeft'
            : event.key;
      let targetBounds: DataTableCellRangeBounds;
      if (logicalKey === 'ArrowUp') {
        targetBounds = {
          ...rangeBounds,
          rowStart: rangeBounds.rowStart - rowCount,
          rowEnd: rangeBounds.rowStart - 1
        };
      } else if (logicalKey === 'ArrowDown') {
        targetBounds = {
          ...rangeBounds,
          rowStart: rangeBounds.rowEnd + 1,
          rowEnd: rangeBounds.rowEnd + rowCount
        };
      } else if (logicalKey === 'ArrowLeft') {
        targetBounds = {
          ...rangeBounds,
          columnStart: rangeBounds.columnStart - columnCount,
          columnEnd: rangeBounds.columnStart - 1
        };
      } else {
        targetBounds = {
          ...rangeBounds,
          columnStart: rangeBounds.columnEnd + 1,
          columnEnd: rangeBounds.columnEnd + columnCount
        };
      }
      const planSourceBounds = toPlanBounds(rangeBounds);
      const planTargetBounds = toPlanBounds(targetBounds);
      if (
        targetBounds.rowStart < 0 ||
        targetBounds.columnStart < 0 ||
        targetBounds.rowEnd >= rangeIndex.rowIds.length ||
        targetBounds.columnEnd >= rangeIndex.columnIds.length ||
        !planSourceBounds ||
        !planTargetBounds
      ) {
        toast.error(dataTableMessages.fill.targetOutOfBounds);
        return;
      }
      const target = resolveDataTableFillTarget(rangeBounds, {
        rowIndex: logicalKey === 'ArrowUp' ? targetBounds.rowStart : targetBounds.rowEnd,
        columnIndex: logicalKey === 'ArrowLeft' ? targetBounds.columnStart : targetBounds.columnEnd
      });
      if (!target) return;
      runAtomicFill({
        ...target,
        sourceRange: range,
        sourceBounds: rangeBounds,
        planSourceBounds,
        planTargetBounds
      });
    },
    [
      range,
      rangeBounds,
      rangeIndex,
      runAtomicFill,
      scrollViewportRef,
      selectedRangeIsFillable,
      toPlanBounds
    ]
  );

  const handleCellKeyDown = useCallback(
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
      activeCellSelectionOwner = ownerRef.current;
      emitDataTableCellSelectionChange(ownerRef.current);
      setRange((current) => ({
        anchor: event.shiftKey && current && rangeBounds ? current.anchor : next,
        focus: next
      }));
      focusCoordinate(next);
    },
    [
      clearCellSelection,
      cellsByCoordinate,
      editing,
      focusCoordinate,
      isCellEditable,
      pasteColumns,
      range,
      rangeBounds,
      rangeIndex,
      runAtomicMatrixInput,
      scrollViewportRef,
      startCellEditing
    ]
  );

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
          if (!editable || shouldIgnoreTarget?.(event.target, event.currentTarget)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          startCellEditing(cell);
        },
        onKeyDown: (event) => handleCellKeyDown(event, cell)
      };
    },
    [
      beginPointerSelection,
      copyFeedback?.run,
      copyFeedbackBounds,
      editing,
      fillPreviewBounds,
      fillPreviewSourceBounds,
      handleCellFocus,
      handleCellKeyDown,
      ownerId,
      range,
      rangeBounds,
      rangeIndex,
      isCellEditable,
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

  const getCellFillHandleProps = useCallback(
    (cell: Cell<TData, unknown>): DataTableCellFillHandleProps | null => {
      if (
        !editing ||
        editing.activeCell ||
        !selectedRangeIsFillable ||
        !range ||
        !rangeBounds ||
        activeCellSelectionOwner !== ownerRef.current
      ) {
        return null;
      }
      const coordinate = getCellCoordinate(cell);
      const rowId = rangeIndex.rowIds[rangeBounds.rowEnd];
      const columnId = rangeIndex.columnIds[rangeBounds.columnEnd];
      if (coordinate.rowId !== rowId || coordinate.columnId !== columnId) return null;

      return {
        type: 'button',
        tabIndex: 0,
        'aria-label': '填充所选单元格',
        'aria-description': '使用方向键填充相邻区域，或拖动控制点填充。',
        'data-slot': 'data-table-cell-fill-handle',
        onPointerDown: beginFillPointer,
        onKeyDown: fillWithKeyboard,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
        }
      };
    },
    [
      beginFillPointer,
      editing,
      fillWithKeyboard,
      range,
      rangeBounds,
      rangeIndex,
      selectedRangeIsFillable
    ]
  );

  useEffect(() => {
    if (range && !rangeBounds) clearCellSelection();
  }, [clearCellSelection, range, rangeBounds]);

  useEffect(() => {
    pasteRequestSequenceRef.current += 1;
    matrixPasteAbortRef.current?.abort();
    matrixPasteAbortRef.current = null;
  }, [range]);

  useEffect(() => {
    const handleSelectionChange = (event: Event) => {
      const detail = (event as CustomEvent<DataTableCellSelectionChangeDetail>).detail;
      if (detail?.owner !== ownerRef.current) {
        finishPointerSelection();
        finishFillPointer();
        editing?.clearCellSelection();
        setRange(null);
        setCopyFeedback(null);
        setFillPreview(null);
      }
    };
    window.addEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
    return () =>
      window.removeEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
  }, [editing, finishFillPointer, finishPointerSelection]);

  useEffect(() => {
    const handleWindowBlur = () => {
      finishPointerSelection();
      finishFillPointer();
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [finishFillPointer, finishPointerSelection]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (
        activeCellSelectionOwner !== ownerRef.current ||
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
  }, [cellsByCoordinate, flashCopiedRange, range, rangeBounds, rangeIndex]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (
        activeCellSelectionOwner !== ownerRef.current ||
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
    pasteColumns,
    range,
    rangeBounds,
    rangeIndex,
    runAtomicMatrixInput
  ]);

  useEffect(() => {
    return () => {
      pasteRequestSequenceRef.current += 1;
      matrixPasteAbortRef.current?.abort();
      matrixPasteAbortRef.current = null;
      finishPointerSelection();
      finishFillPointer();
      clearCopyFeedbackTimeout();
      if (activeCellSelectionOwner === ownerRef.current) activeCellSelectionOwner = null;
    };
  }, [clearCopyFeedbackTimeout, finishFillPointer, finishPointerSelection]);

  return { getCellFillHandleProps, getCellSelectionProps, getCellServerError };
}
