import * as React from 'react';

import type {
  DataTableActiveEditingCell,
  DataTableCellEditableContext,
  DataTableCellChange,
  DataTableChoiceValue,
  DataTableEditChangeReason,
  DataTableEditableColumnMeta,
  DataTableEditingCellCoordinate,
  DataTableEditingController,
  DataTableEditingOptions,
  DataTableEditingRuntime
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

function isEmptyEditableValue<TData>(config: DataTableEditableColumnMeta<TData>, value: unknown) {
  if ('editor' in config) {
    return config.editor === 'input' ? value == null || value === '' : false;
  }
  return config.selectionMode === 'multiple'
    ? value == null || (Array.isArray(value) && value.length === 0)
    : value == null;
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
  const editingSessionSequenceRef = React.useRef(0);
  const activeCellRef = React.useRef<DataTableActiveEditingCell<TData> | null>(null);
  const readyCellRef = React.useRef<DataTableEditingCellCoordinate | null>(null);
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
      if (activeCell?.rowId !== rowId) return committedRow;

      const row = cloneRow(committedRow);
      setRowField(row, activeCell.field, activeCell.value);
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
      if (
        !previousRowIds ||
        previousRowIds.length !== nextRowIds.length ||
        previousRowIds.some((rowId, index) => rowId !== nextRowIds[index])
      ) {
        stateChanged = true;
      }
      if (stateChanged) notify();
    },
    [getCommittedRow, notify]
  );

  const updateCell = React.useCallback(
    (update: DataTableCellUpdate<TData>) => {
      const config = editableFieldsRef.current.get(update.field);
      if (!config || (!config.allowEmpty && isEmptyEditableValue(config, update.value))) {
        return false;
      }
      const baseRow = baseRowsByIdRef.current.get(update.rowId);
      const currentRow = getCommittedRow(update.rowId);
      if (!baseRow || !currentRow) return false;
      const previousValue = currentRow[update.field];
      if (areEditableValuesEqual(previousValue, update.value)) return false;

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
      notify();
      optionsRef.current?.onChange?.({
        changes: [change],
        snapshot: getSnapshot(),
        reason: update.reason
      });
      return true;
    },
    [getCommittedRow, getSnapshot, notify]
  );

  const acceptChanges = React.useCallback(
    (changes: readonly DataTableCellChange<TData>[], serverRows?: readonly TData[]) => {
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
      notify();
    },
    [getCommittedRow, notify]
  );

  const discardChanges = React.useCallback(() => {
    draftRowsByIdRef.current.clear();
    activeCellRef.current = null;
    readyCellRef.current = null;
    notify();
  }, [notify]);

  const reset = React.useCallback(() => {
    baseRowsByIdRef.current.clear();
    draftRowsByIdRef.current.clear();
    loadedPageRowIdsRef.current.clear();
    latestRowLocationRef.current.clear();
    activeCellRef.current = null;
    readyCellRef.current = null;
    notify();
  }, [notify]);

  const loadScopePage = React.useCallback(
    (scopeKey: string, pageNo: number, rows: readonly TData[]) => {
      if (scopeKeyRef.current !== scopeKey) {
        baseRowsByIdRef.current.clear();
        draftRowsByIdRef.current.clear();
        loadedPageRowIdsRef.current.clear();
        latestRowLocationRef.current.clear();
        activeCellRef.current = null;
        readyCellRef.current = null;
        scopeKeyRef.current = scopeKey;
      }
      loadPage(pageNo, rows);
    },
    [loadPage]
  );

  const controller = React.useMemo<DataTableEditingController<TData>>(
    () => ({
      getSnapshot,
      hasChanges: () => getSnapshot().changes.length > 0,
      acceptChanges,
      discardChanges
    }),
    [acceptChanges, discardChanges, getSnapshot]
  );

  const finishEditingSession = React.useCallback(
    (
      sessionId: number,
      reason: DataTableEditChangeReason,
      nextInteractionState: 'selected' | 'edit-ready' = reason === 'blur'
        ? 'edit-ready'
        : 'selected'
    ) => {
      const activeCell = activeCellRef.current;
      if (!activeCell || activeCell.sessionId !== sessionId) return false;

      activeCellRef.current = null;
      readyCellRef.current =
        nextInteractionState === 'edit-ready'
          ? { rowId: activeCell.rowId, columnId: activeCell.columnId }
          : null;
      const changed = updateCell({
        rowId: activeCell.rowId,
        field: activeCell.field,
        value: activeCell.value,
        reason
      } as DataTableCellUpdate<TData>);
      if (!changed) notify();
      return true;
    },
    [notify, updateCell]
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
          finishEditingSession(currentActiveCell.sessionId, 'blur', 'selected');
        }
        editingSessionSequenceRef.current += 1;
        const sessionId = editingSessionSequenceRef.current;
        readyCellRef.current = null;
        activeCellRef.current = { ...context, sessionId };
        notify();
        return sessionId;
      },
      setActiveValue: (sessionId, value) => {
        const currentActiveCell = activeCellRef.current;
        if (!currentActiveCell || currentActiveCell.sessionId !== sessionId) return;
        const config = editableFieldsRef.current.get(currentActiveCell.field);
        if (
          config &&
          !config.allowEmpty &&
          isEmptyEditableValue(config, value) &&
          (!('editor' in config) || config.editor !== 'input')
        ) {
          return;
        }
        activeCellRef.current = { ...currentActiveCell, value };
        notify();
      },
      finishEditing: (sessionId, reason) => {
        finishEditingSession(sessionId, reason);
      },
      cancelEditing: (sessionId) => {
        const activeCell = activeCellRef.current;
        if (!activeCell || activeCell.sessionId !== sessionId) return;
        activeCellRef.current = null;
        readyCellRef.current = {
          rowId: activeCell.rowId,
          columnId: activeCell.columnId
        };
        notify();
      },
      commitValue: (context, reason) => {
        if (
          optionsRef.current?.isCellEditable?.({
            rowId: context.rowId,
            row: context.row,
            columnId: context.columnId
          }) === false
        ) {
          return;
        }
        selectCell(context);
        updateCell({
          rowId: context.rowId,
          field: context.field,
          value: context.value,
          reason
        } as DataTableCellUpdate<TData>);
      }
    }),
    [
      activeCell,
      clearCellSelection,
      finishEditingSession,
      isSameCell,
      notify,
      readyCell,
      selectCell,
      updateCell
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
    scopeKey: scopeKeyRef.current,
    updateCell
  };
}

export function isDataTableChoiceValue(value: unknown): value is DataTableChoiceValue {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}
