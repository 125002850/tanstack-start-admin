import type { Cell } from '@tanstack/react-table';
import {
  useCallback,
  useRef,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction
} from 'react';

import { DATA_TABLE_ROW_HEIGHT_PX } from '@/config/data-table';
import type { DataTableEditingRuntime } from '../editing/types';
import type {
  DataTableCellCoordinate,
  DataTableCellRange,
  DataTableCellRangeIndex
} from './data-table-cell-range';
import { getCoordinateKey, isSameCoordinate } from './model';
import { useDataTableCellAutoScroll } from './use-data-table-cell-auto-scroll';

type ActivePointerSelection = {
  pointerId: number;
  handlePointerMove: (event: PointerEvent) => void;
  captureTarget: HTMLElement;
};

type CellPointer = {
  clientX: number;
  clientY: number;
  target?: EventTarget | null;
};

export function useDataTableCellPointer<TData>({
  ownerId,
  rangeIndex,
  cellsByCoordinate,
  scrollViewportRef,
  editing,
  setRange
}: {
  ownerId: string;
  rangeIndex: DataTableCellRangeIndex;
  cellsByCoordinate: ReadonlyMap<string, Cell<TData, unknown>>;
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  editing?: DataTableEditingRuntime<TData>;
  setRange: Dispatch<SetStateAction<DataTableCellRange | null>>;
}) {
  const activePointerRef = useRef<ActivePointerSelection | null>(null);
  const suppressNextFocusSelectionRef = useRef(false);
  const stopAutoScrollRef = useRef<() => void>(() => undefined);
  const cellElementsRef = useRef(new Map<string, HTMLTableCellElement>());

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

  const findOwnedCell = useCallback(
    (element: Element | null): HTMLTableCellElement | null => {
      const cell = element?.closest<HTMLTableCellElement>('[data-cell-id]') ?? null;
      return cell?.dataset.cellSelectionOwner === ownerId ? cell : null;
    },
    [ownerId]
  );

  const findCellAtPointer = useCallback(
    ({ clientX, clientY, target }: CellPointer, captured: boolean) => {
      const stackedElements = document.elementsFromPoint?.(clientX, clientY) ?? [];
      for (const element of stackedElements) {
        const cell = findOwnedCell(element);
        if (cell) return cell;
      }

      const targetCell = findOwnedCell(target instanceof Element ? target : null);
      if (targetCell && !captured) return targetCell;

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
    (pointer: CellPointer) => {
      const activePointer = activePointerRef.current;
      const captured = Boolean(
        activePointer?.captureTarget.hasPointerCapture?.(activePointer.pointerId)
      );
      const cell = findCellAtPointer(pointer, captured);
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
    [cellsByCoordinate, editing, findCellAtPointer, readCellCoordinate, setRange]
  );

  const { stop: stopAutoScroll, updatePointer: updateAutoScrollPointer } =
    useDataTableCellAutoScroll({
      viewportRef: scrollViewportRef,
      onScrollFrame: updateRangeFocusAtPointer
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
        cellSize: cell.getBoundingClientRect().height || DATA_TABLE_ROW_HEIGHT_PX
      });
    },
    [updateAutoScrollPointer, updateRangeFocusAtPointer]
  );

  const beginPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLTableCellElement>) => {
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
    [finishPointerSelection, handleDocumentPointerMove, scrollViewportRef]
  );

  const focusCoordinate = useCallback((coordinate: DataTableCellCoordinate) => {
    suppressNextFocusSelectionRef.current = true;
    cellElementsRef.current.get(getCoordinateKey(coordinate))?.focus({ preventScroll: true });
    suppressNextFocusSelectionRef.current = false;
  }, []);

  const isFocusSelectionSuppressed = useCallback(() => suppressNextFocusSelectionRef.current, []);

  return {
    beginPointerDrag,
    cellElementsRef,
    findCellAtPointer,
    finishPointerSelection,
    focusCoordinate,
    isFocusSelectionSuppressed,
    readCellCoordinate
  };
}
