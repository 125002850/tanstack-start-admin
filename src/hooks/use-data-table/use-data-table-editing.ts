import * as React from 'react';

import { dataTableMessages } from '@/config/data-table-messages';
import type {
  DataTableAcceptChangesOptions,
  DataTableActiveEditingCell,
  DataTableActiveEditingParseState,
  DataTableBatchCommit,
  DataTableCellCommit,
  DataTableCellEditInput,
  DataTableCellEditableContext,
  DataTableCellChange,
  DataTableChoiceValue,
  DataTableEditCodec,
  DataTableEditChangeReason,
  DataTableEditableColumnMeta,
  DataTableFinishEditingResult,
  DataTableEditingCellCoordinate,
  DataTableEditingController,
  DataTableEditorAnchorOptions,
  DataTableEditingOptions,
  DataTableEditingRuntime,
  DataTableProgrammaticEditRequest,
  DataTableServerCellErrorBatch,
  DataTableServerCellErrorClearRequest,
  DataTableServerCellErrorMutationResult,
  DataTableServerCellErrorState
} from '@/types/data-table';

type EditableField<TData> = Extract<keyof TData, string>;

type DataTableCellUpdate<TData> = {
  [K in EditableField<TData>]: {
    rowId: string;
    field: K;
    value: TData[K];
    reason: DataTableEditChangeReason;
  };
}[EditableField<TData>];

type UseDataTableEditingOptions<TData> = {
  tableId: string;
  editableFields: ReadonlyMap<EditableField<TData>, DataTableEditableColumnMeta<TData>>;
  getRowId: (row: TData, index: number) => string;
  options?: DataTableEditingOptions<TData>;
};

type LatestRowLocation = {
  pageNo: number;
  sequence: number;
};

type EditorAnchorRegistration = {
  sessionId: number;
  token: symbol;
};

function noopEditorAnchorCleanup() {}

function getServerCellErrorKey(rowId: string, field: string): string {
  return `${rowId}\u0000${field}`;
}

function areEditableValuesEqual(left: unknown, right: unknown) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => Object.is(value, right[index]));
  }

  return Object.is(left, right);
}

function areServerValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areServerValuesEqual(value, right[index]))
    );
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        areServerValuesEqual(leftRecord[key], rightRecord[key])
    )
  );
}

function cloneRow<TData>(row: TData): TData {
  return Object.assign({}, row) as TData;
}

function setRowField<TData>(row: TData, field: EditableField<TData>, value: unknown) {
  (row as Record<string, unknown>)[field] = value;
}

function uniqueRowIds(rowIds: readonly string[]) {
  return [...new Set(rowIds)];
}

function getEditableCodec<TData>(
  editableCell: DataTableEditableColumnMeta<TData>
): DataTableEditCodec<TData, unknown> | null {
  const codec = editableCell.codec as Partial<DataTableEditCodec<TData, unknown>> | undefined;
  return codec &&
    typeof codec.formatForEdit === 'function' &&
    typeof codec.parse === 'function' &&
    typeof codec.validate === 'function'
    ? (codec as DataTableEditCodec<TData, unknown>)
    : null;
}

function resolveActiveEditingParseState<TData>(
  editableCell: DataTableEditableColumnMeta<TData>,
  draftValue: unknown,
  row: TData,
  shouldParse = true
): DataTableActiveEditingParseState {
  if (!shouldParse) {
    return {
      parseState: 'unparsed',
      validationErrors: []
    };
  }

  const codec = getEditableCodec(editableCell);
  if (!codec) {
    return {
      parseState: 'invalid',
      validationErrors: [dataTableMessages.editing.codecUnavailable]
    };
  }
  const parseResult = codec.parse(draftValue, row);
  if (parseResult.status === 'invalid') {
    return {
      parseState: 'invalid',
      validationErrors: parseResult.errors
    };
  }

  const validationErrors = codec.validate(parseResult.value, row);
  if (validationErrors.length > 0) {
    return {
      parseState: 'invalid',
      candidateValue: parseResult.value,
      validationErrors
    };
  }

  return {
    parseState: 'valid',
    candidateValue: parseResult.value,
    validationErrors: []
  };
}

/**
 * DataTable 字段草稿引擎。
 *
 * Map 保存在 ref 中，使 controller 方法始终同步读取最新状态；React state 只负责通知
 * table 重新渲染，不作为 dirty 真相源。
 */
export function useDataTableEditing<TData>({
  tableId,
  editableFields,
  getRowId,
  options
}: UseDataTableEditingOptions<TData>) {
  const baseRowsByIdRef = React.useRef(new Map<string, TData>());
  const draftRowsByIdRef = React.useRef(new Map<string, TData>());
  const loadedPageRowIdsRef = React.useRef(new Map<number, string[]>());
  const latestRowLocationRef = React.useRef(new Map<string, LatestRowLocation>());
  const scopeKeyRef = React.useRef<string | null>(null);
  const sequenceRef = React.useRef(0);
  const revisionRef = React.useRef(0);
  const cellRevisionByKeyRef = React.useRef(new Map<string, number>());
  const serverCellErrorsByKeyRef = React.useRef(
    new Map<string, DataTableServerCellErrorState<TData>>()
  );
  const editingSessionSequenceRef = React.useRef(0);
  const activeCellRef = React.useRef<DataTableActiveEditingCell<TData> | null>(null);
  const readyCellRef = React.useRef<DataTableEditingCellCoordinate | null>(null);
  const editorAnchorRef = React.useRef<EditorAnchorRegistration | null>(null);
  const optionsRef = React.useRef(options);
  const editableFieldsRef = React.useRef(editableFields);
  const getRowIdRef = React.useRef(getRowId);
  const [, render] = React.useReducer((version: number) => version + 1, 0);
  React.useDebugValue(`${tableId}:${editableFields.size} editable fields`);

  optionsRef.current = options;
  editableFieldsRef.current = editableFields;
  getRowIdRef.current = getRowId;

  const notify = React.useCallback(() => {
    render();
  }, []);

  const advanceRevision = React.useCallback(() => {
    revisionRef.current += 1;
    return revisionRef.current;
  }, []);

  const getServerCellError = React.useCallback(
    (rowId: string, field: EditableField<TData>) =>
      serverCellErrorsByKeyRef.current.get(getServerCellErrorKey(rowId, field)),
    []
  );

  const getServerCellErrors = React.useCallback(
    () => [...serverCellErrorsByKeyRef.current.values()],
    []
  );

  const markCellRevision = React.useCallback(
    (rowId: string, field: EditableField<TData>, revision: number) => {
      const key = getServerCellErrorKey(rowId, field);
      cellRevisionByKeyRef.current.set(
        key,
        Math.max(cellRevisionByKeyRef.current.get(key) ?? 0, revision)
      );
    },
    []
  );

  const canApplyServerCellResult = React.useCallback(
    (rowId: string, field: EditableField<TData>, revision: number) => {
      const key = getServerCellErrorKey(rowId, field);
      const cellRevision = cellRevisionByKeyRef.current.get(key) ?? 0;
      const errorRevision = serverCellErrorsByKeyRef.current.get(key)?.revision ?? 0;
      return cellRevision <= revision && errorRevision <= revision;
    },
    []
  );

  const clearServerCellErrorValue = React.useCallback(
    (rowId: string, field: EditableField<TData>) =>
      serverCellErrorsByKeyRef.current.delete(getServerCellErrorKey(rowId, field)),
    []
  );

  const setServerCellErrors = React.useCallback(
    (batch: DataTableServerCellErrorBatch<TData>): DataTableServerCellErrorMutationResult => {
      let applied = 0;
      let skipped = 0;
      for (const error of batch.errors) {
        const editableCell = editableFieldsRef.current.get(error.field);
        const messages = error.messages.filter((message) => message.trim().length > 0);
        if (
          !editableCell ||
          !baseRowsByIdRef.current.has(error.rowId) ||
          messages.length === 0 ||
          !canApplyServerCellResult(error.rowId, error.field, batch.revision)
        ) {
          skipped += 1;
          continue;
        }
        const key = getServerCellErrorKey(error.rowId, error.field);
        serverCellErrorsByKeyRef.current.set(
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
        advanceRevision();
        notify();
      }
      return { applied, skipped };
    },
    [advanceRevision, canApplyServerCellResult, notify]
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
        : [...serverCellErrorsByKeyRef.current.values()].map(({ rowId, field }) => ({
            rowId,
            field,
            key: getServerCellErrorKey(rowId, field)
          }));
      let applied = 0;
      let skipped = 0;
      for (const candidate of candidates) {
        if (!serverCellErrorsByKeyRef.current.has(candidate.key)) {
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
        serverCellErrorsByKeyRef.current.delete(candidate.key);
        applied += 1;
      }
      if (applied > 0) {
        advanceRevision();
        notify();
      }
      return { applied, skipped };
    },
    [advanceRevision, canApplyServerCellResult, notify]
  );

  const getCommittedRow = React.useCallback((rowId: string): TData | undefined => {
    const baseRow = baseRowsByIdRef.current.get(rowId);
    if (!baseRow) return undefined;
    return draftRowsByIdRef.current.get(rowId) ?? baseRow;
  }, []);

  const getDisplayRow = React.useCallback(
    (rowId: string): TData | undefined => {
      const committedRow = getCommittedRow(rowId);
      if (!committedRow) return undefined;
      const activeCell = activeCellRef.current;
      if (activeCell?.rowId !== rowId || activeCell.parseState !== 'valid') {
        return committedRow;
      }

      const row = cloneRow(committedRow);
      setRowField(row, activeCell.field, activeCell.candidateValue);
      return row;
    },
    [getCommittedRow]
  );

  const isSameCell = React.useCallback(
    (left: DataTableEditingCellCoordinate | null, right: DataTableEditingCellCoordinate | null) =>
      Boolean(left && right && left.rowId === right.rowId && left.columnId === right.columnId),
    []
  );

  const rowHasChanges = React.useCallback(
    (rowId: string) => {
      const baseRow = baseRowsByIdRef.current.get(rowId);
      const committedRow = getCommittedRow(rowId);
      if (!baseRow || !committedRow) return false;

      for (const field of editableFieldsRef.current.keys()) {
        if (!areEditableValuesEqual(baseRow[field], committedRow[field])) return true;
      }
      return false;
    },
    [getCommittedRow]
  );

  const getSnapshot = React.useCallback(() => {
    const loadedPages = [...loadedPageRowIdsRef.current.keys()].toSorted(
      (left, right) => left - right
    );
    const rows: TData[] = [];
    const changedRows: TData[] = [];
    const changes: DataTableCellChange<TData>[] = [];
    const emittedRowIds = new Set<string>();

    for (const pageNo of loadedPages) {
      const rowIds = loadedPageRowIdsRef.current.get(pageNo) ?? [];
      for (const rowId of rowIds) {
        if (
          emittedRowIds.has(rowId) ||
          latestRowLocationRef.current.get(rowId)?.pageNo !== pageNo
        ) {
          continue;
        }

        const baseRow = baseRowsByIdRef.current.get(rowId);
        const committedRow = getCommittedRow(rowId);
        if (!baseRow || !committedRow) continue;
        emittedRowIds.add(rowId);
        rows.push(committedRow);

        let changed = false;
        for (const field of editableFieldsRef.current.keys()) {
          if (areEditableValuesEqual(baseRow[field], committedRow[field])) continue;
          changed = true;
          changes.push({
            rowId,
            field,
            previousValue: baseRow[field],
            value: committedRow[field]
          } as DataTableCellChange<TData>);
        }
        if (changed) changedRows.push(committedRow);
      }
    }

    return { rows, changedRows, changes, loadedPages };
  }, [getCommittedRow]);

  const getRowsForPage = React.useCallback(
    (pageNo: number) => {
      const rows: TData[] = [];
      for (const rowId of loadedPageRowIdsRef.current.get(pageNo) ?? []) {
        if (latestRowLocationRef.current.get(rowId)?.pageNo !== pageNo) continue;
        const row = getDisplayRow(rowId);
        if (row) rows.push(row);
      }
      return rows;
    },
    [getDisplayRow]
  );

  const loadPage = React.useCallback(
    (pageNo: number, rows: readonly TData[]) => {
      sequenceRef.current += 1;
      const sequence = sequenceRef.current;
      const rowIds: string[] = [];
      let stateChanged = false;
      let serverErrorsChanged = false;
      const refreshedCells: Array<{ rowId: string; field: EditableField<TData> }> = [];

      rows.forEach((serverRow, index) => {
        const rowId = getRowIdRef.current(serverRow, index);
        const previousBase = baseRowsByIdRef.current.get(rowId);
        const previousDraft = draftRowsByIdRef.current.get(rowId);
        const previousLocation = latestRowLocationRef.current.get(rowId);
        const previousCommitted = getCommittedRow(rowId);
        const nextBase = cloneRow(serverRow);
        const nextDraft = cloneRow(nextBase);
        let hasDraft = false;

        if (previousBase && previousCommitted) {
          for (const field of editableFieldsRef.current.keys()) {
            const previousValue = previousCommitted[field];
            if (areEditableValuesEqual(previousBase[field], previousValue)) continue;
            nextDraft[field] = previousValue;
            if (!areEditableValuesEqual(nextBase[field], nextDraft[field])) hasDraft = true;
          }
        }

        baseRowsByIdRef.current.set(rowId, nextBase);
        if (hasDraft) draftRowsByIdRef.current.set(rowId, nextDraft);
        else draftRowsByIdRef.current.delete(rowId);
        if (previousBase) {
          for (const field of editableFieldsRef.current.keys()) {
            refreshedCells.push({ rowId, field });
            const retainsLocalDraft = !areEditableValuesEqual(nextBase[field], nextDraft[field]);
            if (!retainsLocalDraft) {
              serverErrorsChanged = clearServerCellErrorValue(rowId, field) || serverErrorsChanged;
            }
          }
        }
        latestRowLocationRef.current.set(rowId, { pageNo, sequence });
        rowIds.push(rowId);
        if (
          previousLocation?.pageNo !== pageNo ||
          !previousBase ||
          !areServerValuesEqual(previousBase, nextBase) ||
          (hasDraft
            ? !previousDraft || !areServerValuesEqual(previousDraft, nextDraft)
            : previousDraft !== undefined)
        ) {
          stateChanged = true;
        }
      });

      const nextRowIds = uniqueRowIds(rowIds);
      const previousRowIds = loadedPageRowIdsRef.current.get(pageNo);
      loadedPageRowIdsRef.current.set(pageNo, nextRowIds);
      for (const removedRowId of previousRowIds ?? []) {
        if (nextRowIds.includes(removedRowId)) continue;
        const remainsLoaded = [...loadedPageRowIdsRef.current.values()].some((pageRowIds) =>
          pageRowIds.includes(removedRowId)
        );
        if (remainsLoaded) continue;
        for (const [key, error] of serverCellErrorsByKeyRef.current) {
          if (error.rowId !== removedRowId) continue;
          serverCellErrorsByKeyRef.current.delete(key);
          serverErrorsChanged = true;
        }
      }
      if (
        !previousRowIds ||
        previousRowIds.length !== nextRowIds.length ||
        previousRowIds.some((rowId, index) => rowId !== nextRowIds[index])
      ) {
        stateChanged = true;
      }
      if (stateChanged || serverErrorsChanged || refreshedCells.length > 0) {
        const revision = advanceRevision();
        for (const { rowId, field } of refreshedCells) {
          markCellRevision(rowId, field, revision);
        }
      }
      if (stateChanged || serverErrorsChanged) {
        notify();
      }
    },
    [advanceRevision, clearServerCellErrorValue, getCommittedRow, markCellRevision, notify]
  );

  const applyCellUpdate = React.useCallback(
    (update: DataTableCellUpdate<TData>): DataTableFinishEditingResult => {
      const baseRow = baseRowsByIdRef.current.get(update.rowId);
      const currentRow = getCommittedRow(update.rowId);
      if (!baseRow || !currentRow) {
        return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
      }
      const previousValue = currentRow[update.field];
      if (areEditableValuesEqual(previousValue, update.value)) {
        return { status: 'unchanged' };
      }

      const nextDraft = cloneRow(currentRow);
      setRowField(nextDraft, update.field, update.value);
      const remainsChanged = [...editableFieldsRef.current.keys()].some(
        (field) => !areEditableValuesEqual(baseRow[field], nextDraft[field])
      );
      if (remainsChanged) draftRowsByIdRef.current.set(update.rowId, nextDraft);
      else draftRowsByIdRef.current.delete(update.rowId);

      const change = {
        rowId: update.rowId,
        field: update.field,
        previousValue,
        value: update.value
      } as DataTableCellChange<TData>;
      const revision = advanceRevision();
      markCellRevision(update.rowId, update.field, revision);
      clearServerCellErrorValue(update.rowId, update.field);
      notify();
      optionsRef.current?.onChange?.({
        changes: [change],
        snapshot: getSnapshot(),
        reason: update.reason
      });
      return { status: 'committed' };
    },
    [
      advanceRevision,
      clearServerCellErrorValue,
      getCommittedRow,
      getSnapshot,
      markCellRevision,
      notify
    ]
  );

  const commitCandidate = React.useCallback(
    (
      context: DataTableCellCommit<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      const currentRow = getCommittedRow(context.rowId);
      if (!currentRow) {
        return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
      }
      if (
        optionsRef.current?.isCellEditable?.({
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
    [applyCellUpdate, getCommittedRow]
  );

  const commitInput = React.useCallback(
    (
      context: DataTableCellEditInput<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      const currentRow = getCommittedRow(context.rowId);
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
    [commitCandidate, getCommittedRow]
  );

  const applyBatch = React.useCallback(
    (
      context: DataTableBatchCommit<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      if (context.revision !== revisionRef.current) {
        return { status: 'blocked', errors: [dataTableMessages.editing.batchPlanStale] };
      }
      if (activeCellRef.current) {
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
            const committedRow = getCommittedRow(commit.rowId);
            if (!committedRow) return undefined;
            const projectedRow = cloneRow(committedRow);
            projectedRows.set(commit.rowId, projectedRow);
            return projectedRow;
          })();
        if (!currentRow || !baseRowsByIdRef.current.has(commit.rowId)) {
          return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
        }

        const editableCell = editableFieldsRef.current.get(commit.field);
        if (!editableCell || editableCell.field !== commit.field) {
          return { status: 'blocked', errors: [dataTableMessages.editing.columnUnavailable] };
        }
        if (
          optionsRef.current?.isCellEditable?.({
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
        const baseRow = baseRowsByIdRef.current.get(rowId);
        if (!baseRow) {
          return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
        }
        const remainsChanged = [...editableFieldsRef.current.keys()].some(
          (field) => !areEditableValuesEqual(baseRow[field], projectedRow[field])
        );
        if (remainsChanged) draftRowsByIdRef.current.set(rowId, projectedRow);
        else draftRowsByIdRef.current.delete(rowId);
      }

      const revision = advanceRevision();
      for (const change of changes) {
        markCellRevision(change.rowId, change.field, revision);
        clearServerCellErrorValue(change.rowId, change.field);
      }
      notify();
      optionsRef.current?.onChange?.({
        changes,
        snapshot: getSnapshot(),
        reason
      });
      return { status: 'committed' };
    },
    [
      advanceRevision,
      clearServerCellErrorValue,
      getCommittedRow,
      getSnapshot,
      markCellRevision,
      notify
    ]
  );

  const acceptChanges = React.useCallback(
    (
      changes: readonly DataTableCellChange<TData>[],
      serverRows?: readonly TData[],
      acceptOptions?: DataTableAcceptChangesOptions
    ) => {
      const serverRowsById = new Map<string, TData>();
      serverRows?.forEach((row, index) => {
        serverRowsById.set(getRowIdRef.current(row, index), row);
      });
      const changesByRowId = new Map<string, DataTableCellChange<TData>[]>();
      for (const change of changes) {
        const rowChanges = changesByRowId.get(change.rowId) ?? [];
        rowChanges.push(change);
        changesByRowId.set(change.rowId, rowChanges);
      }

      for (const [rowId, rowChanges] of changesByRowId) {
        const previousBase = baseRowsByIdRef.current.get(rowId);
        const previousCommitted = getCommittedRow(rowId);
        if (!previousBase || !previousCommitted) continue;
        const serverRow = serverRowsById.get(rowId);
        const nextBase = serverRow ? cloneRow(serverRow) : cloneRow(previousBase);

        for (const change of rowChanges) {
          if (!serverRow) {
            setRowField(nextBase, change.field, change.value);
          }
        }

        const nextDraft = cloneRow(nextBase);
        let hasDraft = false;
        for (const field of editableFieldsRef.current.keys()) {
          const submittedChange = rowChanges.find((change) => change.field === field);
          const currentMatchesSubmitted =
            submittedChange &&
            areEditableValuesEqual(previousCommitted[field], submittedChange.value);
          if (
            !currentMatchesSubmitted &&
            !areEditableValuesEqual(previousBase[field], previousCommitted[field])
          ) {
            nextDraft[field] = previousCommitted[field];
          }
          if (!areEditableValuesEqual(nextBase[field], nextDraft[field])) hasDraft = true;
        }

        baseRowsByIdRef.current.set(rowId, nextBase);
        if (hasDraft) draftRowsByIdRef.current.set(rowId, nextDraft);
        else draftRowsByIdRef.current.delete(rowId);
      }
      const revision = advanceRevision();
      for (const change of changes) {
        if (
          acceptOptions?.revision !== undefined &&
          !canApplyServerCellResult(change.rowId, change.field, acceptOptions.revision)
        ) {
          continue;
        }
        clearServerCellErrorValue(change.rowId, change.field);
        markCellRevision(change.rowId, change.field, acceptOptions?.revision ?? revision);
      }
      notify();
    },
    [
      advanceRevision,
      canApplyServerCellResult,
      clearServerCellErrorValue,
      getCommittedRow,
      markCellRevision,
      notify
    ]
  );

  const discardChanges = React.useCallback(() => {
    draftRowsByIdRef.current.clear();
    serverCellErrorsByKeyRef.current.clear();
    cellRevisionByKeyRef.current.clear();
    activeCellRef.current = null;
    readyCellRef.current = null;
    editorAnchorRef.current = null;
    advanceRevision();
    notify();
  }, [advanceRevision, notify]);

  const reset = React.useCallback(() => {
    baseRowsByIdRef.current.clear();
    draftRowsByIdRef.current.clear();
    serverCellErrorsByKeyRef.current.clear();
    cellRevisionByKeyRef.current.clear();
    loadedPageRowIdsRef.current.clear();
    latestRowLocationRef.current.clear();
    activeCellRef.current = null;
    readyCellRef.current = null;
    editorAnchorRef.current = null;
    advanceRevision();
    notify();
  }, [advanceRevision, notify]);

  const loadScopePage = React.useCallback(
    (scopeKey: string, pageNo: number, rows: readonly TData[]) => {
      if (scopeKeyRef.current !== scopeKey) {
        baseRowsByIdRef.current.clear();
        draftRowsByIdRef.current.clear();
        serverCellErrorsByKeyRef.current.clear();
        cellRevisionByKeyRef.current.clear();
        loadedPageRowIdsRef.current.clear();
        latestRowLocationRef.current.clear();
        activeCellRef.current = null;
        readyCellRef.current = null;
        editorAnchorRef.current = null;
        scopeKeyRef.current = scopeKey;
        advanceRevision();
      }
      loadPage(pageNo, rows);
    },
    [advanceRevision, loadPage]
  );

  const clearEditorAnchor = React.useCallback((sessionId: number) => {
    if (editorAnchorRef.current?.sessionId === sessionId) {
      editorAnchorRef.current = null;
    }
  }, []);

  const finishEditingSession = React.useCallback(
    (
      sessionId: number,
      reason: DataTableEditChangeReason,
      nextInteractionState: 'selected' | 'edit-ready' = reason === 'blur'
        ? 'edit-ready'
        : 'selected'
    ): DataTableFinishEditingResult => {
      const activeCell = activeCellRef.current;
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
        activeCellRef.current = null;
        readyCellRef.current =
          !isVirtualizationDetach && nextInteractionState === 'edit-ready'
            ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
            : null;
        notify();
        return {
          status: 'reverted',
          reason: isVirtualizationDetach ? 'virtualization-detach' : 'invalid-edit',
          ...(finishErrors.length > 0 ? { errors: finishErrors } : {})
        };
      }

      if (isVirtualizationDetach && activeCell.editableCell.commitMode === 'explicit-confirm') {
        clearEditorAnchor(sessionId);
        activeCellRef.current = null;
        readyCellRef.current = null;
        notify();
        return {
          status: 'reverted',
          reason: 'virtualization-detach'
        };
      }

      const result = commitCandidate(
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
          activeCellRef.current = {
            ...activeCell,
            parseState: 'invalid',
            candidateValue: activeCell.candidateValue,
            validationErrors: result.errors
          };
          notify();
          return result;
        }

        clearEditorAnchor(sessionId);
        activeCellRef.current = null;
        readyCellRef.current =
          !isVirtualizationDetach && nextInteractionState === 'edit-ready'
            ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
            : null;
        notify();
        return {
          status: 'reverted',
          reason: isVirtualizationDetach ? 'virtualization-detach' : 'invalid-edit',
          errors: result.errors
        };
      }

      clearEditorAnchor(sessionId);
      activeCellRef.current = null;
      readyCellRef.current =
        nextInteractionState === 'edit-ready'
          ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
          : null;
      if (result.status === 'unchanged') notify();
      return result;
    },
    [clearEditorAnchor, commitCandidate, notify]
  );

  const registerEditorAnchor = React.useCallback(
    (sessionId: number, anchorOptions?: DataTableEditorAnchorOptions) => {
      if (activeCellRef.current?.sessionId !== sessionId) {
        return noopEditorAnchorCleanup;
      }

      const token = Symbol(`data-table-editor-anchor:${sessionId}`);
      editorAnchorRef.current = { sessionId, token };

      return () => {
        const currentAnchor = editorAnchorRef.current;
        if (
          !currentAnchor ||
          currentAnchor.sessionId !== sessionId ||
          currentAnchor.token !== token
        ) {
          return;
        }

        editorAnchorRef.current = null;
        queueMicrotask(() => {
          if (editorAnchorRef.current?.sessionId === sessionId) return;
          anchorOptions?.closePopup?.();
          finishEditingSession(sessionId, 'virtualization-detach', 'selected');
        });
      };
    },
    [finishEditingSession]
  );

  const selectCell = React.useCallback(
    (context: DataTableCellEditableContext<TData>) => {
      const activeCell = activeCellRef.current;
      if (activeCell && !isSameCell(activeCell, context)) {
        finishEditingSession(activeCell.sessionId, 'blur', 'selected');
        return;
      }

      const readyCell = readyCellRef.current;
      if (readyCell && !isSameCell(readyCell, context)) {
        readyCellRef.current = null;
        notify();
      }
    },
    [finishEditingSession, isSameCell, notify]
  );

  const clearCellSelection = React.useCallback(() => {
    const activeCell = activeCellRef.current;
    if (activeCell) {
      finishEditingSession(activeCell.sessionId, 'blur', 'selected');
      return;
    }
    if (!readyCellRef.current) return;
    readyCellRef.current = null;
    notify();
  }, [finishEditingSession, notify]);

  const commitRuntimeInput = React.useCallback(
    (
      context: DataTableCellEditInput<TData>,
      reason: DataTableEditChangeReason
    ): DataTableFinishEditingResult => {
      const currentActiveCell = activeCellRef.current;
      if (currentActiveCell && !isSameCell(currentActiveCell, context)) {
        const finishResult = finishEditingSession(currentActiveCell.sessionId, 'blur', 'selected');
        if (finishResult.status === 'blocked') return finishResult;
      }
      selectCell(context);
      return commitInput(context, reason);
    },
    [commitInput, finishEditingSession, isSameCell, selectCell]
  );

  const writeCell = React.useCallback(
    (request: DataTableProgrammaticEditRequest<TData>): DataTableFinishEditingResult => {
      const currentRow = getCommittedRow(request.rowId);
      if (!currentRow) {
        return { status: 'blocked', errors: [dataTableMessages.editing.rowUnavailable] };
      }
      const editableCell = editableFieldsRef.current.get(request.field);
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
    [commitRuntimeInput, getCommittedRow]
  );

  const activeCell = activeCellRef.current;
  const readyCell = readyCellRef.current;
  const runtime = React.useMemo<DataTableEditingRuntime<TData>>(
    () => ({
      activeCell,
      readyCell,
      isCellEditable: (context) =>
        editableFieldsRef.current.size > 0 &&
        optionsRef.current?.isCellEditable?.(context) !== false,
      selectCell,
      clearCellSelection,
      startEditing: (context) => {
        if (
          optionsRef.current?.isCellEditable?.({
            rowId: context.rowId,
            row: context.row,
            columnId: context.columnId
          }) === false
        ) {
          return null;
        }
        const currentActiveCell = activeCellRef.current;
        if (currentActiveCell && isSameCell(currentActiveCell, context)) {
          return currentActiveCell.sessionId;
        }
        if (currentActiveCell) {
          const finishResult = finishEditingSession(
            currentActiveCell.sessionId,
            'blur',
            'selected'
          );
          if (finishResult.status === 'blocked') return null;
        }
        const editableCell = context.editableCell ?? editableFieldsRef.current.get(context.field);
        if (!editableCell) return null;
        const codec = getEditableCodec(editableCell);
        if (!codec) return null;
        editingSessionSequenceRef.current += 1;
        const sessionId = editingSessionSequenceRef.current;
        const draftValue = codec.formatForEdit(context.initialValue, context.row);
        readyCellRef.current = null;
        activeCellRef.current = {
          ...context,
          sessionId,
          draftValue,
          editableCell,
          ...resolveActiveEditingParseState(editableCell, draftValue, context.row)
        };
        const revision = advanceRevision();
        markCellRevision(context.rowId, editableCell.field, revision);
        notify();
        return sessionId;
      },
      setActiveDraft: (sessionId, draftValue, setOptions) => {
        const currentActiveCell = activeCellRef.current;
        if (!currentActiveCell || currentActiveCell.sessionId !== sessionId) return;
        activeCellRef.current = {
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
        notify();
      },
      registerEditorAnchor,
      finishEditing: finishEditingSession,
      cancelEditing: (sessionId) => {
        const activeCell = activeCellRef.current;
        if (!activeCell || activeCell.sessionId !== sessionId) return;
        clearEditorAnchor(sessionId);
        activeCellRef.current = null;
        readyCellRef.current = {
          rowId: activeCell.rowId,
          columnId: activeCell.columnId
        };
        notify();
      },
      commitCandidate: (context, reason) => {
        const currentActiveCell = activeCellRef.current;
        if (currentActiveCell && !isSameCell(currentActiveCell, context)) {
          const finishResult = finishEditingSession(
            currentActiveCell.sessionId,
            'blur',
            'selected'
          );
          if (finishResult.status === 'blocked') return finishResult;
        }
        selectCell(context);
        return commitCandidate(context, reason);
      },
      commitInput: commitRuntimeInput,
      getRevision: () => revisionRef.current,
      getServerCellError,
      applyBatch
    }),
    [
      activeCell,
      advanceRevision,
      applyBatch,
      clearEditorAnchor,
      clearCellSelection,
      commitCandidate,
      commitRuntimeInput,
      finishEditingSession,
      getServerCellError,
      isSameCell,
      markCellRevision,
      notify,
      readyCell,
      registerEditorAnchor,
      selectCell
    ]
  );

  const controller = React.useMemo<DataTableEditingController<TData>>(
    () => ({
      getRevision: () => revisionRef.current,
      getSnapshot,
      getServerCellErrors,
      hasChanges: () => getSnapshot().changes.length > 0,
      acceptChanges,
      discardChanges,
      setServerCellErrors,
      clearServerCellErrors,
      writeCell
    }),
    [
      acceptChanges,
      clearServerCellErrors,
      discardChanges,
      getServerCellErrors,
      getSnapshot,
      setServerCellErrors,
      writeCell
    ]
  );

  return {
    ...controller,
    controller,
    runtime,
    activeCell,
    readyCell,
    getRowsForPage,
    hasLoadedPage: (pageNo: number) => loadedPageRowIdsRef.current.has(pageNo),
    loadPage,
    loadScopePage,
    reset,
    rowHasChanges,
    scopeKey: scopeKeyRef.current
  };
}

export function isDataTableChoiceValue(value: unknown): value is DataTableChoiceValue {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}
