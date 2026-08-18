import type { Cell } from '@tanstack/react-table';
import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react';
import { toast } from 'sonner';

import { DATA_TABLE_ROW_HEIGHT_PX } from '@/config/data-table';
import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableEditingRuntime } from '../editing/types';
import {
  resolveDataTableFillTarget,
  type DataTableFillBounds
} from '../editing/batch/data-table-fill-plan';
import type {
  DataTableCellCoordinate,
  DataTableCellRange,
  DataTableCellRangeBounds,
  DataTableCellRangeIndex
} from './data-table-cell-range';
import { getCellCoordinate } from './model';
import { isDataTableCellSelectionOwnerActive } from './data-table-cell-selection-owner';
import type { DataTableCellFillHandleProps, DataTableFillPreviewState } from './types';
import { useDataTableCellAutoScroll } from './use-data-table-cell-auto-scroll';

type CellPointer = {
  clientX: number;
  clientY: number;
  target?: EventTarget | null;
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

export function useDataTableCellFill<TData>({
  owner,
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
}: {
  owner: symbol;
  range: DataTableCellRange | null;
  rangeBounds: DataTableCellRangeBounds | null;
  rangeIndex: DataTableCellRangeIndex;
  selectedRangeIsFillable: boolean;
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  editing?: DataTableEditingRuntime<TData>;
  findCellAtPointer: (pointer: CellPointer, captured: boolean) => HTMLTableCellElement | null;
  readCellCoordinate: (cell: HTMLTableCellElement) => DataTableCellCoordinate | null;
  toPlanBounds: (bounds: DataTableCellRangeBounds) => DataTableFillBounds | null;
  finishPointerSelection: () => void;
  clearCopyFeedback: () => void;
  runAtomicFill: (preview: DataTableFillPreviewState) => void;
}) {
  const activeFillPointerRef = useRef<ActiveFillPointer | null>(null);
  const fillPreviewRef = useRef<DataTableFillPreviewState | null>(null);
  const [fillPreview, setFillPreview] = useState<DataTableFillPreviewState | null>(null);
  fillPreviewRef.current = fillPreview;

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

  const updateFillPreviewAtPointer = useCallback(
    (pointer: CellPointer) => {
      const activeFill = activeFillPointerRef.current;
      if (!activeFill) return null;
      const captured = activeFill.captureTarget.hasPointerCapture?.(activeFill.pointerId) ?? false;
      const cell = findCellAtPointer(pointer, captured);
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
      onScrollFrame: updateFillPreviewAtPointer
    });
  const stopAutoScrollRef = useRef(stopAutoScroll);
  stopAutoScrollRef.current = stopAutoScroll;

  const handleDocumentFillPointerMove = useCallback(
    (event: PointerEvent) => {
      if (event.pointerId !== activeFillPointerRef.current?.pointerId) return;
      const cell = updateFillPreviewAtPointer(event);
      if (!cell) return;
      event.preventDefault();
      updateAutoScrollPointer({
        clientX: event.clientX,
        clientY: event.clientY,
        cellSize: cell.getBoundingClientRect().height || DATA_TABLE_ROW_HEIGHT_PX
      });
    },
    [updateAutoScrollPointer, updateFillPreviewAtPointer]
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
        !isDataTableCellSelectionOwnerActive(owner)
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
      clearCopyFeedback();
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
      clearCopyFeedback,
      editing?.activeCell,
      finishFillPointer,
      finishPointerSelection,
      handleDocumentFillPointerEnd,
      handleDocumentFillPointerMove,
      owner,
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

  const getCellFillHandleProps = useCallback(
    (cell: Cell<TData, unknown>): DataTableCellFillHandleProps | null => {
      if (
        !editing ||
        editing.activeCell ||
        !selectedRangeIsFillable ||
        !range ||
        !rangeBounds ||
        !isDataTableCellSelectionOwnerActive(owner)
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
      owner,
      range,
      rangeBounds,
      rangeIndex,
      selectedRangeIsFillable
    ]
  );

  return {
    fillPreview,
    finishFillPointer,
    getCellFillHandleProps
  };
}
