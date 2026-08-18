import * as React from 'react';

import { dataTableMessages } from '@/config/data-table-messages';
import type {
  DataTableCellCommit,
  DataTableCellEditInput,
  DataTableCellEditableContext,
  DataTableEditChangeReason,
  DataTableEditingStartContext,
  DataTableEditorAnchorOptions,
  DataTableFinishEditingResult,
  DataTableProgrammaticEditRequest
} from '../types';

import type { DataTableEditingStore } from './types';
import {
  getEditableCodec,
  isSameEditingCell,
  resolveActiveEditingParseState
} from './data-table-editing-values';
import type { DataTableEditingCommits } from './use-data-table-editing-commits';
import type { DataTableEditingErrors } from './use-data-table-editing-errors';
import type { DataTableEditingRows } from './use-data-table-editing-rows';

function noopEditorAnchorCleanup() {}

export interface DataTableEditingSession<TData> {
  selectCell(context: DataTableCellEditableContext<TData>): void;
  clearCellSelection(): void;
  startEditing(context: DataTableEditingStartContext<TData>): number | null;
  setActiveDraft(sessionId: number, draftValue: unknown, options?: { parse?: boolean }): void;
  registerEditorAnchor(sessionId: number, options?: DataTableEditorAnchorOptions): () => void;
  finishEditing(
    sessionId: number,
    reason: DataTableEditChangeReason,
    nextInteractionState?: 'selected' | 'edit-ready'
  ): DataTableFinishEditingResult;
  cancelEditing(sessionId: number): void;
  commitCandidate(
    context: DataTableCellCommit<TData>,
    reason: DataTableEditChangeReason
  ): DataTableFinishEditingResult;
  commitInput(
    context: DataTableCellEditInput<TData>,
    reason: DataTableEditChangeReason
  ): DataTableFinishEditingResult;
  writeCell(request: DataTableProgrammaticEditRequest<TData>): DataTableFinishEditingResult;
}

/** 管理 active/edit-ready/session/anchor 状态机。 */
export function useDataTableEditingSession<TData>(
  store: DataTableEditingStore<TData>,
  rows: DataTableEditingRows<TData>,
  errors: DataTableEditingErrors<TData>,
  commits: DataTableEditingCommits<TData>
): DataTableEditingSession<TData> {
  const clearEditorAnchor = React.useCallback(
    (sessionId: number) => {
      if (store.editorAnchorRef.current?.sessionId === sessionId) {
        store.editorAnchorRef.current = null;
      }
    },
    [store]
  );

  const finishEditingSession = React.useCallback(
    (
      sessionId: number,
      reason: DataTableEditChangeReason,
      nextInteractionState: 'selected' | 'edit-ready' = reason === 'blur'
        ? 'edit-ready'
        : 'selected'
    ): DataTableFinishEditingResult => {
      const activeCell = store.activeCellRef.current;
      if (!activeCell || activeCell.sessionId !== sessionId) {
        return { status: 'stale-session' };
      }

      const finishErrors =
        activeCell.parseState === 'unparsed'
          ? ['Value has not been parsed.']
          : activeCell.parseState === 'invalid'
            ? activeCell.validationErrors
            : [];
      const isVirtualizationDetach = reason === 'virtualization-detach';
      if (activeCell.parseState !== 'valid') {
        if (!isVirtualizationDetach && activeCell.editableCell.invalidEditBehavior === 'block') {
          return { status: 'blocked', errors: finishErrors };
        }

        clearEditorAnchor(sessionId);
        store.activeCellRef.current = null;
        store.readyCellRef.current =
          !isVirtualizationDetach && nextInteractionState === 'edit-ready'
            ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
            : null;
        store.notify();
        return {
          status: 'reverted',
          reason: isVirtualizationDetach ? 'virtualization-detach' : 'invalid-edit',
          ...(finishErrors.length > 0 ? { errors: finishErrors } : {})
        };
      }

      if (
        activeCell.editableCell.commitMode === 'explicit-confirm' &&
        (reason === 'blur' || isVirtualizationDetach)
      ) {
        clearEditorAnchor(sessionId);
        store.activeCellRef.current = null;
        store.readyCellRef.current =
          !isVirtualizationDetach && nextInteractionState === 'edit-ready'
            ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
            : null;
        store.notify();
        return {
          status: 'reverted',
          reason: isVirtualizationDetach ? 'virtualization-detach' : 'explicit-confirm-detach'
        };
      }

      const result = commits.commitCandidate(
        {
          rowId: activeCell.rowId,
          row: activeCell.row,
          columnId: activeCell.columnId,
          field: activeCell.field,
          value: activeCell.candidateValue,
          editableCell: activeCell.editableCell
        },
        reason
      );
      if (result.status === 'blocked') {
        if (!isVirtualizationDetach && activeCell.editableCell.invalidEditBehavior === 'block') {
          store.activeCellRef.current = {
            ...activeCell,
            parseState: 'invalid',
            candidateValue: activeCell.candidateValue,
            validationErrors: result.errors
          };
          store.notify();
          return result;
        }

        clearEditorAnchor(sessionId);
        store.activeCellRef.current = null;
        store.readyCellRef.current =
          !isVirtualizationDetach && nextInteractionState === 'edit-ready'
            ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
            : null;
        store.notify();
        return {
          status: 'reverted',
          reason: isVirtualizationDetach ? 'virtualization-detach' : 'invalid-edit',
          errors: result.errors
        };
      }

      clearEditorAnchor(sessionId);
      store.activeCellRef.current = null;
      store.readyCellRef.current =
        nextInteractionState === 'edit-ready'
          ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
          : null;
      if (result.status === 'unchanged') store.notify();
      return result;
    },
    [clearEditorAnchor, commits, store]
  );

  const registerEditorAnchor = React.useCallback(
    (sessionId: number, anchorOptions?: DataTableEditorAnchorOptions) => {
      if (store.activeCellRef.current?.sessionId !== sessionId) {
        return noopEditorAnchorCleanup;
      }

      const token = Symbol(`data-table-editor-anchor:${sessionId}`);
      store.editorAnchorRef.current = { sessionId, token };

      return () => {
        const currentAnchor = store.editorAnchorRef.current;
        if (
          !currentAnchor ||
          currentAnchor.sessionId !== sessionId ||
          currentAnchor.token !== token
        ) {
          return;
        }

        store.editorAnchorRef.current = null;
        queueMicrotask(() => {
          if (store.editorAnchorRef.current?.sessionId === sessionId) return;
          anchorOptions?.closePopup?.();
          finishEditingSession(sessionId, 'virtualization-detach', 'selected');
        });
      };
    },
    [finishEditingSession, store]
  );

  const selectCell = React.useCallback(
    (context: DataTableCellEditableContext<TData>) => {
      const activeCell = store.activeCellRef.current;
      if (activeCell && !isSameEditingCell(activeCell, context)) {
        finishEditingSession(activeCell.sessionId, 'blur', 'selected');
        return;
      }

      const readyCell = store.readyCellRef.current;
      if (readyCell && !isSameEditingCell(readyCell, context)) {
        store.readyCellRef.current = null;
        store.notify();
      }
    },
    [finishEditingSession, store]
  );

  const clearCellSelection = React.useCallback(() => {
    const activeCell = store.activeCellRef.current;
    if (activeCell) {
      finishEditingSession(activeCell.sessionId, 'blur', 'selected');
      return;
    }
    if (!store.readyCellRef.current) return;
    store.readyCellRef.current = null;
    store.notify();
  }, [finishEditingSession, store]);

  const startEditing = React.useCallback(
    (context: DataTableEditingStartContext<TData>) => {
      if (
        store.optionsRef.current?.isCellEditable?.({
          rowId: context.rowId,
          row: context.row,
          columnId: context.columnId
        }) === false
      ) {
        return null;
      }
      const currentActiveCell = store.activeCellRef.current;
      if (currentActiveCell && isSameEditingCell(currentActiveCell, context)) {
        return currentActiveCell.sessionId;
      }
      if (currentActiveCell) {
        const finishResult = finishEditingSession(currentActiveCell.sessionId, 'blur', 'selected');
        if (finishResult.status === 'blocked') return null;
      }
      const editableCell =
        context.editableCell ?? store.editableFieldsRef.current.get(context.field);
      if (!editableCell) return null;
      const codec = getEditableCodec(editableCell);
      if (!codec) return null;
      store.editingSessionSequenceRef.current += 1;
      const sessionId = store.editingSessionSequenceRef.current;
      const draftValue = codec.formatForEdit(context.initialValue, context.row);
      store.readyCellRef.current = null;
      store.activeCellRef.current = {
        ...context,
        sessionId,
        draftValue,
        editableCell,
        ...resolveActiveEditingParseState(editableCell, draftValue, context.row)
      };
      const revision = store.advanceRevision();
      errors.markCellRevision(context.rowId, editableCell.field, revision);
      store.notify();
      return sessionId;
    },
    [errors, finishEditingSession, store]
  );

  const setActiveDraft = React.useCallback(
    (sessionId: number, draftValue: unknown, setOptions?: { parse?: boolean }) => {
      const currentActiveCell = store.activeCellRef.current;
      if (!currentActiveCell || currentActiveCell.sessionId !== sessionId) return;
      store.activeCellRef.current = {
        sessionId: currentActiveCell.sessionId,
        rowId: currentActiveCell.rowId,
        row: currentActiveCell.row,
        columnId: currentActiveCell.columnId,
        field: currentActiveCell.field,
        initialValue: currentActiveCell.initialValue,
        editableCell: currentActiveCell.editableCell,
        draftValue,
        ...resolveActiveEditingParseState(
          currentActiveCell.editableCell,
          draftValue,
          currentActiveCell.row,
          setOptions?.parse !== false
        )
      };
      store.notify();
    },
    [store]
  );

  const cancelEditing = React.useCallback(
    (sessionId: number) => {
      const activeCell = store.activeCellRef.current;
      if (!activeCell || activeCell.sessionId !== sessionId) return;
      clearEditorAnchor(sessionId);
      store.activeCellRef.current = null;
      store.readyCellRef.current = {
        rowId: activeCell.rowId,
        columnId: activeCell.columnId
      };
      store.notify();
    },
    [clearEditorAnchor, store]
  );

  const commitRuntimeCandidate = React.useCallback(
    (context: DataTableCellCommit<TData>, reason: DataTableEditChangeReason) => {
      const currentActiveCell = store.activeCellRef.current;
      if (currentActiveCell && !isSameEditingCell(currentActiveCell, context)) {
        const finishResult = finishEditingSession(currentActiveCell.sessionId, 'blur', 'selected');
        if (finishResult.status === 'blocked') return finishResult;
      }
      selectCell(context);
      return commits.commitCandidate(context, reason);
    },
    [commits, finishEditingSession, selectCell, store]
  );

  const commitRuntimeInput = React.useCallback(
    (
      context: DataTableCellEditInput<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      const currentActiveCell = store.activeCellRef.current;
      if (currentActiveCell && !isSameEditingCell(currentActiveCell, context)) {
        const finishResult = finishEditingSession(currentActiveCell.sessionId, 'blur', 'selected');
        if (finishResult.status === 'blocked') return finishResult;
      }
      selectCell(context);
      return commits.commitInput(context, reason);
    },
    [commits, finishEditingSession, selectCell, store]
  );

  const writeCell = React.useCallback(
    (request: DataTableProgrammaticEditRequest<TData>): DataTableFinishEditingResult => {
      const currentRow = rows.getCommittedRow(request.rowId);
      if (!currentRow) {
        return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
      }
      const editableCell = store.editableFieldsRef.current.get(request.field);
      if (!editableCell) {
        return { status: 'blocked', errors: [dataTableMessages.editing.columnUnavailable] };
      }

      return commitRuntimeInput(
        {
          rowId: request.rowId,
          row: currentRow,
          columnId: request.field,
          field: request.field,
          input: request.input,
          editableCell
        },
        'programmatic'
      );
    },
    [commitRuntimeInput, rows, store]
  );

  return React.useMemo(
    () => ({
      selectCell,
      clearCellSelection,
      startEditing,
      setActiveDraft,
      registerEditorAnchor,
      finishEditing: finishEditingSession,
      cancelEditing,
      commitCandidate: commitRuntimeCandidate,
      commitInput: commitRuntimeInput,
      writeCell
    }),
    [
      cancelEditing,
      clearCellSelection,
      commitRuntimeCandidate,
      commitRuntimeInput,
      finishEditingSession,
      registerEditorAnchor,
      selectCell,
      setActiveDraft,
      startEditing,
      writeCell
    ]
  );
}
