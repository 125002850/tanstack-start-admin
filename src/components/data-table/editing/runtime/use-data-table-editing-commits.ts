import * as React from 'react';

import { dataTableMessages } from '@/config/data-table-messages';
import type {
  DataTableBatchCommit,
  DataTableCellChange,
  DataTableCellCommit,
  DataTableCellEditInput,
  DataTableEditChangeReason,
  DataTableFinishEditingResult
} from '../types';

import type { DataTableCellUpdate, DataTableEditingStore } from './types';
import {
  areEditableValuesEqual,
  cloneRow,
  getEditableCodec,
  setRowField
} from './data-table-editing-values';
import type { DataTableEditingErrors } from './use-data-table-editing-errors';
import type { DataTableEditingRows } from './use-data-table-editing-rows';

export interface DataTableEditingCommits<TData> {
  commitCandidate(
    context: DataTableCellCommit<TData>,
    reason: DataTableEditChangeReason
  ): DataTableFinishEditingResult;
  commitInput(
    context: DataTableCellEditInput<TData>,
    reason: DataTableEditChangeReason
  ): DataTableFinishEditingResult;
  applyBatch(
    context: DataTableBatchCommit<TData>,
    reason: DataTableEditChangeReason
  ): DataTableFinishEditingResult;
}

/** 执行单元格与批量提交；所有批量写入均先完整预检再原子应用。 */
export function useDataTableEditingCommits<TData>(
  store: DataTableEditingStore<TData>,
  rows: DataTableEditingRows<TData>,
  errors: DataTableEditingErrors<TData>
): DataTableEditingCommits<TData> {
  const applyCellUpdate = React.useCallback(
    (update: DataTableCellUpdate<TData>): DataTableFinishEditingResult => {
      const baseRow = store.baseRowsByIdRef.current.get(update.rowId);
      const currentRow = rows.getCommittedRow(update.rowId);
      if (!baseRow || !currentRow) {
        return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
      }
      const previousValue = currentRow[update.field];
      if (areEditableValuesEqual(previousValue, update.value)) {
        return { status: 'unchanged' };
      }

      const nextDraft = cloneRow(currentRow);
      setRowField(nextDraft, update.field, update.value);
      const remainsChanged = [...store.editableFieldsRef.current.keys()].some(
        (field) => !areEditableValuesEqual(baseRow[field], nextDraft[field])
      );
      if (remainsChanged) store.draftRowsByIdRef.current.set(update.rowId, nextDraft);
      else store.draftRowsByIdRef.current.delete(update.rowId);

      const change = {
        rowId: update.rowId,
        field: update.field,
        previousValue,
        value: update.value
      } as DataTableCellChange<TData>;
      const revision = store.advanceRevision();
      errors.markCellRevision(update.rowId, update.field, revision);
      errors.clearServerCellErrorValue(update.rowId, update.field);
      store.notify();
      store.optionsRef.current?.onChange?.({
        changes: [change],
        snapshot: rows.getSnapshot(),
        reason: update.reason
      });
      return { status: 'committed' };
    },
    [errors, rows, store]
  );

  const commitCandidate = React.useCallback(
    (
      context: DataTableCellCommit<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      const currentRow = rows.getCommittedRow(context.rowId);
      if (!currentRow) {
        return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
      }
      if (
        store.optionsRef.current?.isCellEditable?.({
          rowId: context.rowId,
          row: currentRow,
          columnId: context.columnId
        }) === false
      ) {
        return { status: 'blocked', errors: [dataTableMessages.editing.cellNotEditable] };
      }

      const codec = getEditableCodec(context.editableCell);
      if (!codec) {
        return { status: 'blocked', errors: [dataTableMessages.editing.codecUnavailable] };
      }
      const validationErrors = codec.validate(context.value, currentRow);
      if (validationErrors.length > 0) {
        return { status: 'blocked', errors: validationErrors };
      }

      return applyCellUpdate({
        rowId: context.rowId,
        field: context.field,
        value: context.value,
        reason
      } as DataTableCellUpdate<TData>);
    },
    [applyCellUpdate, rows, store]
  );

  const commitInput = React.useCallback(
    (
      context: DataTableCellEditInput<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      const currentRow = rows.getCommittedRow(context.rowId);
      if (!currentRow) {
        return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
      }
      const codec = getEditableCodec(context.editableCell);
      if (!codec) {
        return { status: 'blocked', errors: [dataTableMessages.editing.codecUnavailable] };
      }

      if (context.input.kind === 'raw-draft') {
        const parseResult = codec.parse(context.input.value, currentRow);
        if (parseResult.status === 'invalid') {
          return { status: 'blocked', errors: parseResult.errors };
        }
        return commitCandidate(
          {
            rowId: context.rowId,
            row: currentRow,
            columnId: context.columnId,
            field: context.field,
            value: parseResult.value,
            editableCell: context.editableCell
          },
          reason
        );
      }

      return commitCandidate(
        {
          rowId: context.rowId,
          row: currentRow,
          columnId: context.columnId,
          field: context.field,
          value: context.input.value,
          editableCell: context.editableCell
        },
        reason
      );
    },
    [commitCandidate, rows]
  );

  const applyBatch = React.useCallback(
    (
      context: DataTableBatchCommit<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      if (context.revision !== store.revisionRef.current) {
        return { status: 'blocked', errors: [dataTableMessages.editing.batchPlanStale] };
      }
      if (store.activeCellRef.current) {
        return {
          status: 'blocked',
          errors: [dataTableMessages.editing.activeSessionBeforeBatch]
        };
      }
      if (context.commits.length === 0) {
        return { status: 'unchanged' };
      }

      const projectedRows = new Map<string, TData>();
      const seenCells = new Set<string>();
      const changes: DataTableCellChange<TData>[] = [];

      for (const commit of context.commits) {
        const cellKey = `${commit.rowId}\u0000${commit.columnId}`;
        if (seenCells.has(cellKey)) {
          return {
            status: 'blocked',
            errors: [dataTableMessages.editing.duplicateBatchTarget]
          };
        }
        seenCells.add(cellKey);

        const currentRow =
          projectedRows.get(commit.rowId) ??
          (() => {
            const committedRow = rows.getCommittedRow(commit.rowId);
            if (!committedRow) return undefined;
            const projectedRow = cloneRow(committedRow);
            projectedRows.set(commit.rowId, projectedRow);
            return projectedRow;
          })();
        if (!currentRow || !store.baseRowsByIdRef.current.has(commit.rowId)) {
          return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
        }

        const editableCell = store.editableFieldsRef.current.get(commit.field);
        if (!editableCell || editableCell.field !== commit.field) {
          return { status: 'blocked', errors: [dataTableMessages.editing.columnUnavailable] };
        }
        if (
          store.optionsRef.current?.isCellEditable?.({
            rowId: commit.rowId,
            row: currentRow,
            columnId: commit.columnId
          }) === false
        ) {
          return { status: 'blocked', errors: [dataTableMessages.editing.cellNotEditable] };
        }

        const codec = getEditableCodec(editableCell);
        if (!codec) {
          return { status: 'blocked', errors: [dataTableMessages.editing.codecUnavailable] };
        }
        const validationErrors = codec.validate(commit.value, currentRow);
        if (validationErrors.length > 0) {
          return { status: 'blocked', errors: validationErrors };
        }

        const previousValue = currentRow[commit.field];
        if (areEditableValuesEqual(previousValue, commit.value)) continue;
        changes.push({
          rowId: commit.rowId,
          field: commit.field,
          previousValue,
          value: commit.value
        } as DataTableCellChange<TData>);
        setRowField(currentRow, commit.field, commit.value);
      }

      if (changes.length === 0) {
        return { status: 'unchanged' };
      }

      for (const [rowId, projectedRow] of projectedRows) {
        const baseRow = store.baseRowsByIdRef.current.get(rowId);
        if (!baseRow) {
          return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
        }
        const remainsChanged = [...store.editableFieldsRef.current.keys()].some(
          (field) => !areEditableValuesEqual(baseRow[field], projectedRow[field])
        );
        if (remainsChanged) store.draftRowsByIdRef.current.set(rowId, projectedRow);
        else store.draftRowsByIdRef.current.delete(rowId);
      }

      const revision = store.advanceRevision();
      for (const change of changes) {
        errors.markCellRevision(change.rowId, change.field, revision);
        errors.clearServerCellErrorValue(change.rowId, change.field);
      }
      store.notify();
      store.optionsRef.current?.onChange?.({
        changes,
        snapshot: rows.getSnapshot(),
        reason
      });
      return { status: 'committed' };
    },
    [errors, rows, store]
  );

  return React.useMemo(
    () => ({ commitCandidate, commitInput, applyBatch }),
    [applyBatch, commitCandidate, commitInput]
  );
}
