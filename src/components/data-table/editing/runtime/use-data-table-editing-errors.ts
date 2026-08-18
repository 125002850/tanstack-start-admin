import * as React from 'react';

import type {
  DataTableServerCellErrorBatch,
  DataTableServerCellErrorClearRequest,
  DataTableServerCellErrorMutationResult,
  DataTableServerCellErrorState
} from '../types';

import type { DataTableEditingStore, EditableField } from './types';
import { getServerCellErrorKey } from './data-table-editing-values';

export interface DataTableEditingErrors<TData> {
  getServerCellError(
    rowId: string,
    field: EditableField<TData>
  ): DataTableServerCellErrorState<TData> | undefined;
  getServerCellErrors(): readonly DataTableServerCellErrorState<TData>[];
  markCellRevision(rowId: string, field: EditableField<TData>, revision: number): void;
  canApplyServerCellResult(rowId: string, field: EditableField<TData>, revision: number): boolean;
  clearServerCellErrorValue(rowId: string, field: EditableField<TData>): boolean;
  setServerCellErrors(
    batch: DataTableServerCellErrorBatch<TData>
  ): DataTableServerCellErrorMutationResult;
  clearServerCellErrors(
    request?: DataTableServerCellErrorClearRequest<TData>
  ): DataTableServerCellErrorMutationResult;
}

/** 管理服务端字段错误及其与本地 revision 的竞态保护。 */
export function useDataTableEditingErrors<TData>(
  store: DataTableEditingStore<TData>
): DataTableEditingErrors<TData> {
  const getServerCellError = React.useCallback(
    (rowId: string, field: EditableField<TData>) =>
      store.serverCellErrorsByKeyRef.current.get(getServerCellErrorKey(rowId, field)),
    [store]
  );

  const getServerCellErrors = React.useCallback(
    () => [...store.serverCellErrorsByKeyRef.current.values()],
    [store]
  );

  const markCellRevision = React.useCallback(
    (rowId: string, field: EditableField<TData>, revision: number) => {
      const key = getServerCellErrorKey(rowId, field);
      store.cellRevisionByKeyRef.current.set(
        key,
        Math.max(store.cellRevisionByKeyRef.current.get(key) ?? 0, revision)
      );
    },
    [store]
  );

  const canApplyServerCellResult = React.useCallback(
    (rowId: string, field: EditableField<TData>, revision: number) => {
      const key = getServerCellErrorKey(rowId, field);
      const cellRevision = store.cellRevisionByKeyRef.current.get(key) ?? 0;
      const errorRevision = store.serverCellErrorsByKeyRef.current.get(key)?.revision ?? 0;
      return cellRevision <= revision && errorRevision <= revision;
    },
    [store]
  );

  const clearServerCellErrorValue = React.useCallback(
    (rowId: string, field: EditableField<TData>) =>
      store.serverCellErrorsByKeyRef.current.delete(getServerCellErrorKey(rowId, field)),
    [store]
  );

  const setServerCellErrors = React.useCallback(
    (batch: DataTableServerCellErrorBatch<TData>): DataTableServerCellErrorMutationResult => {
      let applied = 0;
      let skipped = 0;
      for (const error of batch.errors) {
        const editableCell = store.editableFieldsRef.current.get(error.field);
        const messages = error.messages.filter((message) => message.trim().length > 0);
        if (
          !editableCell ||
          !store.baseRowsByIdRef.current.has(error.rowId) ||
          messages.length === 0 ||
          !canApplyServerCellResult(error.rowId, error.field, batch.revision)
        ) {
          skipped += 1;
          continue;
        }
        const key = getServerCellErrorKey(error.rowId, error.field);
        store.serverCellErrorsByKeyRef.current.set(
          key,
          Object.freeze({
            rowId: error.rowId,
            field: error.field,
            messages: Object.freeze([...messages]),
            ...(error.code === undefined ? {} : { code: error.code }),
            revision: batch.revision
          }) as DataTableServerCellErrorState<TData>
        );
        applied += 1;
      }
      if (applied > 0) {
        store.advanceRevision();
        store.notify();
      }
      return { applied, skipped };
    },
    [canApplyServerCellResult, store]
  );

  const clearServerCellErrors = React.useCallback(
    (
      request: DataTableServerCellErrorClearRequest<TData> = {}
    ): DataTableServerCellErrorMutationResult => {
      const candidates = request.cells
        ? request.cells.map(({ rowId, field }) => ({
            rowId,
            field,
            key: getServerCellErrorKey(rowId, field)
          }))
        : [...store.serverCellErrorsByKeyRef.current.values()].map(({ rowId, field }) => ({
            rowId,
            field,
            key: getServerCellErrorKey(rowId, field)
          }));
      let applied = 0;
      let skipped = 0;
      for (const candidate of candidates) {
        if (!store.serverCellErrorsByKeyRef.current.has(candidate.key)) {
          skipped += 1;
          continue;
        }
        if (
          request.revision !== undefined &&
          !canApplyServerCellResult(candidate.rowId, candidate.field, request.revision)
        ) {
          skipped += 1;
          continue;
        }
        store.serverCellErrorsByKeyRef.current.delete(candidate.key);
        applied += 1;
      }
      if (applied > 0) {
        store.advanceRevision();
        store.notify();
      }
      return { applied, skipped };
    },
    [canApplyServerCellResult, store]
  );

  return React.useMemo(
    () => ({
      getServerCellError,
      getServerCellErrors,
      markCellRevision,
      canApplyServerCellResult,
      clearServerCellErrorValue,
      setServerCellErrors,
      clearServerCellErrors
    }),
    [
      canApplyServerCellResult,
      clearServerCellErrorValue,
      clearServerCellErrors,
      getServerCellError,
      getServerCellErrors,
      markCellRevision,
      setServerCellErrors
    ]
  );
}
