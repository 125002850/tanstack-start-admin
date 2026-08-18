import * as React from 'react';

import type { DataTableEditingController, DataTableEditingRuntime } from '../types';

import type { UseDataTableEditingOptions } from './types';
import { useDataTableEditingCommits } from './use-data-table-editing-commits';
import { useDataTableEditingErrors } from './use-data-table-editing-errors';
import { useDataTableEditingRows } from './use-data-table-editing-rows';
import { useDataTableEditingSession } from './use-data-table-editing-session';
import { useDataTableEditingStore } from './use-data-table-editing-store';

/** 组装 DataTable 编辑 store、行草稿、错误、提交与 session 能力。 */
export function useDataTableEditing<TData>(options: UseDataTableEditingOptions<TData>) {
  const store = useDataTableEditingStore(options);
  const errors = useDataTableEditingErrors(store);
  const rows = useDataTableEditingRows(store, errors);
  const commits = useDataTableEditingCommits(store, rows, errors);
  const session = useDataTableEditingSession(store, rows, errors, commits);
  const activeCell = store.activeCellRef.current;
  const readyCell = store.readyCellRef.current;

  const runtime = React.useMemo<DataTableEditingRuntime<TData>>(
    () => ({
      activeCell,
      readyCell,
      isCellEditable: (context) =>
        store.editableFieldsRef.current.size > 0 &&
        store.optionsRef.current?.isCellEditable?.(context) !== false,
      selectCell: session.selectCell,
      clearCellSelection: session.clearCellSelection,
      startEditing: session.startEditing,
      setActiveDraft: session.setActiveDraft,
      registerEditorAnchor: session.registerEditorAnchor,
      finishEditing: session.finishEditing,
      cancelEditing: session.cancelEditing,
      commitCandidate: session.commitCandidate,
      commitInput: session.commitInput,
      getRevision: () => store.revisionRef.current,
      getServerCellError: errors.getServerCellError,
      applyBatch: commits.applyBatch
    }),
    [activeCell, commits.applyBatch, errors.getServerCellError, readyCell, session, store]
  );

  const controller = React.useMemo<DataTableEditingController<TData>>(
    () => ({
      getRevision: () => store.revisionRef.current,
      getSnapshot: rows.getSnapshot,
      getServerCellErrors: errors.getServerCellErrors,
      hasChanges: () => rows.getSnapshot().changes.length > 0,
      acceptChanges: rows.acceptChanges,
      discardChanges: rows.discardChanges,
      setServerCellErrors: errors.setServerCellErrors,
      clearServerCellErrors: errors.clearServerCellErrors,
      writeCell: session.writeCell
    }),
    [errors, rows, session.writeCell, store]
  );

  return {
    ...controller,
    controller,
    runtime,
    activeCell,
    readyCell,
    getRowsForPage: rows.getRowsForPage,
    hasLoadedPage: rows.hasLoadedPage,
    loadPage: rows.loadPage,
    loadScopePage: rows.loadScopePage,
    reset: rows.reset,
    rowHasChanges: rows.rowHasChanges,
    scopeKey: store.scopeKeyRef.current
  };
}

export { isDataTableChoiceValue } from './data-table-editing-values';
