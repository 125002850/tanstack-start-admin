import { type Cell, type Column, type Row } from '@tanstack/react-table';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
  type RefObject
} from 'react';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID
} from '@/hooks/use-data-table/constants';
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
  type DataTableCellRange
} from './data-table-cell-range';
import { useDataTableCellAutoScroll } from './use-data-table-cell-auto-scroll';

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
  'data-cell-selected'?: 'true';
  'data-cell-range-anchor'?: 'true';
  'data-cell-range-focus'?: 'true';
  'data-cell-range-edge'?: string;
  onPointerDown: (event: ReactPointerEvent<HTMLTableCellElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTableCellElement>) => void;
};

type UseDataTableCellSelectionOptions<TData> = {
  rows: readonly Row<TData>[];
  columns: readonly Column<TData, unknown>[];
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  shouldIgnoreTarget?: (target: EventTarget | null, currentTarget: HTMLElement) => boolean;
};

type ActivePointerSelection = {
  pointerId: number;
  handlePointerMove: (event: PointerEvent) => void;
  captureTarget: HTMLTableCellElement;
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

function isSameCoordinate(left: DataTableCellCoordinate, right: DataTableCellCoordinate): boolean {
  return left.rowId === right.rowId && left.columnId === right.columnId;
}

export function useDataTableCellSelection<TData>({
  rows,
  columns,
  scrollViewportRef,
  shouldIgnoreTarget
}: UseDataTableCellSelectionOptions<TData>) {
  const ownerRef = useRef(Symbol('data-table-cell-selection'));
  const ownerId = useId();
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const nextCopyFeedbackRunRef = useRef<DataTableCellCopyFeedbackState['run']>('a');
  const activePointerRef = useRef<ActivePointerSelection | null>(null);
  const stopAutoScrollRef = useRef<() => void>(() => undefined);
  const cellElementsRef = useRef(new Map<string, HTMLTableCellElement>());
  const [range, setRange] = useState<DataTableCellRange | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<DataTableCellCopyFeedbackState | null>(null);

  const selectableColumns = useMemo(() => columns.filter(canSelectDataTableColumn), [columns]);
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

  const clearCellSelection = useCallback(() => {
    finishPointerSelection();
    activeCellSelectionOwner = null;
    emitDataTableCellSelectionChange(null);
    setRange(null);
    setCopyFeedback(null);
  }, [finishPointerSelection]);

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
        activePointerRef.current !== null &&
        activePointerRef.current.captureTarget.hasPointerCapture?.(
          activePointerRef.current.pointerId
        );

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

  const updateRangeFocusAtPointer = useCallback(
    (pointer: { clientX: number; clientY: number; target?: EventTarget | null }) => {
      const cell = findCellAtPointer(pointer);
      const coordinate = cell ? readCellCoordinate(cell) : null;
      if (coordinate) {
        setRange((current) =>
          current && !isSameCoordinate(current.focus, coordinate)
            ? { ...current, focus: coordinate }
            : current
        );
      }
      return cell;
    },
    [findCellAtPointer, readCellCoordinate]
  );

  const { stop: stopAutoScroll, updatePointer: updateAutoScrollPointer } =
    useDataTableCellAutoScroll({
      viewportRef: scrollViewportRef,
      onScrollFrame: (pointer) => {
        updateRangeFocusAtPointer(pointer);
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

  const beginPointerSelection = useCallback(
    (event: ReactPointerEvent<HTMLTableCellElement>, cell: Cell<TData, unknown>) => {
      if (event.button !== 0 || shouldIgnoreTarget?.(event.target, event.currentTarget)) return;
      if (!canSelectDataTableCell(cell)) {
        clearCellSelection();
        return;
      }

      const coordinate = getCellCoordinate(cell);
      const nextRange =
        event.shiftKey && range && rangeBounds
          ? { anchor: range.anchor, focus: coordinate }
          : { anchor: coordinate, focus: coordinate };

      finishPointerSelection();
      activeCellSelectionOwner = ownerRef.current;
      emitDataTableCellSelectionChange(ownerRef.current);
      setRange(nextRange);
      setCopyFeedback(null);
      event.currentTarget.focus({ preventScroll: true });
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
      finishPointerSelection,
      handleDocumentPointerMove,
      range,
      rangeBounds,
      shouldIgnoreTarget,
      scrollViewportRef
    ]
  );

  const focusCoordinate = useCallback((coordinate: DataTableCellCoordinate) => {
    cellElementsRef.current.get(getCoordinateKey(coordinate))?.focus({ preventScroll: true });
  }, []);

  const handleCellKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTableCellElement>, cell: Cell<TData, unknown>) => {
      if (event.target !== event.currentTarget || isEditableCopyTarget(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        clearCellSelection();
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
      activeCellSelectionOwner = ownerRef.current;
      emitDataTableCellSelectionChange(ownerRef.current);
      setRange((current) => ({
        anchor: event.shiftKey && current && rangeBounds ? current.anchor : next,
        focus: next
      }));
      focusCoordinate(next);
    },
    [clearCellSelection, focusCoordinate, rangeBounds, rangeIndex, scrollViewportRef]
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
        onPointerDown: (event) => beginPointerSelection(event, cell),
        onKeyDown: (event) => handleCellKeyDown(event, cell)
      };
    },
    [
      beginPointerSelection,
      copyFeedback?.run,
      copyFeedbackBounds,
      handleCellKeyDown,
      ownerId,
      range,
      rangeBounds,
      rangeIndex
    ]
  );

  useEffect(() => {
    if (range && !rangeBounds) clearCellSelection();
  }, [clearCellSelection, range, rangeBounds]);

  useEffect(() => {
    const handleSelectionChange = (event: Event) => {
      const detail = (event as CustomEvent<DataTableCellSelectionChangeDetail>).detail;
      if (detail?.owner !== ownerRef.current) {
        finishPointerSelection();
        setRange(null);
        setCopyFeedback(null);
      }
    };
    window.addEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
    return () =>
      window.removeEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
  }, [finishPointerSelection]);

  useEffect(() => {
    const handleWindowBlur = () => finishPointerSelection();
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [finishPointerSelection]);

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
    return () => {
      finishPointerSelection();
      clearCopyFeedbackTimeout();
      if (activeCellSelectionOwner === ownerRef.current) activeCellSelectionOwner = null;
    };
  }, [clearCopyFeedbackTimeout, finishPointerSelection]);

  return { getCellSelectionProps };
}
