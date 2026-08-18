import type { Row } from '@tanstack/react-table';
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from 'react';
import { toast } from 'sonner';

import { dataTableMessages } from '@/config/data-table-messages';
import type { DataTableEditingRuntime } from '../editing/types';
import {
  prepareDataTableFillPlan,
  type DataTableFillColumn
} from '../editing/batch/data-table-fill-plan';
import {
  prepareDataTableMatrixPaste,
  type DataTableMatrixPasteFailure
} from '../editing/batch/data-table-matrix-paste';
import type {
  DataTableCellCoordinate,
  DataTableCellRange,
  DataTableCellRangeIndex
} from './data-table-cell-range';
import { createRangeFromBounds, isSameRange, unionRangeBounds } from './model';
import { isDataTableCellSelectionOwnerActive } from './data-table-cell-selection-owner';
import type { DataTableFillPreviewState } from './types';

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

type RunAtomicMatrixInputOptions = {
  clipboardText: string;
  anchorRowIndex: number;
  anchorColumnIndex: number;
  requestedRange: DataTableCellRange;
  reason: 'paste' | 'delete';
};

export function useDataTableCellBatchMutation<TData>({
  rows,
  matrixPasteColumnContracts,
  rightPinnedColumnIds,
  resolveColumnLabel,
  editing,
  range,
  rangeRef,
  rangeIndex,
  owner,
  setRange,
  focusCoordinate
}: {
  rows: readonly Row<TData>[];
  matrixPasteColumnContracts: readonly DataTableFillColumn<TData>[];
  rightPinnedColumnIds: readonly string[];
  resolveColumnLabel: (columnId: string) => string;
  editing?: DataTableEditingRuntime<TData>;
  range: DataTableCellRange | null;
  rangeRef: RefObject<DataTableCellRange | null>;
  rangeIndex: DataTableCellRangeIndex;
  owner: symbol;
  setRange: Dispatch<SetStateAction<DataTableCellRange | null>>;
  focusCoordinate: (coordinate: DataTableCellCoordinate) => void;
}) {
  const abortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  const cancelPending = useCallback(() => {
    requestSequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const createRequest = useCallback(() => {
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    requestSequenceRef.current += 1;
    return {
      abortController,
      requestSequence: requestSequenceRef.current
    };
  }, []);

  const isRequestCurrent = useCallback(
    (
      requestSequence: number,
      abortController: AbortController,
      requestedRange: DataTableCellRange
    ) =>
      requestSequence === requestSequenceRef.current &&
      !abortController.signal.aborted &&
      isDataTableCellSelectionOwnerActive(owner) &&
      isSameRange(requestedRange, rangeRef.current),
    [owner, rangeRef]
  );

  const runAtomicMatrixInput = useCallback(
    ({
      clipboardText,
      anchorRowIndex,
      anchorColumnIndex,
      requestedRange,
      reason
    }: RunAtomicMatrixInputOptions) => {
      if (!editing || editing.activeCell) {
        toast.error(
          editing
            ? dataTableMessages.matrix.finishActiveEdit
            : dataTableMessages.matrix.editableTableRequired
        );
        return;
      }

      const { abortController, requestSequence } = createRequest();
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
          if (!isRequestCurrent(requestSequence, abortController, requestedRange)) return;
          abortRef.current = null;

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
          if (requestSequence !== requestSequenceRef.current || abortController.signal.aborted) {
            return;
          }
          abortRef.current = null;
          toast.error(
            error instanceof Error ? error.message : dataTableMessages.matrix.preparationFailed
          );
        });
    },
    [
      createRequest,
      editing,
      isRequestCurrent,
      matrixPasteColumnContracts,
      resolveColumnLabel,
      rightPinnedColumnIds,
      rows
    ]
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

      const { abortController, requestSequence } = createRequest();
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
          if (!isRequestCurrent(requestSequence, abortController, preview.sourceRange)) return;
          abortRef.current = null;

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
          if (requestSequence !== requestSequenceRef.current || abortController.signal.aborted) {
            return;
          }
          abortRef.current = null;
          toast.error(
            error instanceof Error ? error.message : dataTableMessages.fill.preparationFailed
          );
        });
    },
    [
      createRequest,
      editing,
      focusCoordinate,
      isRequestCurrent,
      matrixPasteColumnContracts,
      rangeIndex,
      resolveColumnLabel,
      rightPinnedColumnIds,
      rows,
      setRange
    ]
  );

  useEffect(cancelPending, [cancelPending, range]);
  useEffect(() => cancelPending, [cancelPending]);

  return { runAtomicFill, runAtomicMatrixInput };
}
