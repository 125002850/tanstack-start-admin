import * as React from 'react';

import type {
  DataTableAcceptChangesOptions,
  DataTableCellChange,
  DataTableEditSnapshot
} from '../types';

import type { DataTableEditingStore, EditableField } from './types';
import {
  areEditableValuesEqual,
  areServerValuesEqual,
  cloneRow,
  setRowField,
  uniqueRowIds
} from './data-table-editing-values';
import type { DataTableEditingErrors } from './use-data-table-editing-errors';

export interface DataTableEditingRows<TData> {
  getCommittedRow(rowId: string): TData | undefined;
  getDisplayRow(rowId: string): TData | undefined;
  rowHasChanges(rowId: string): boolean;
  getSnapshot(): DataTableEditSnapshot<TData>;
  getRowsForPage(pageNo: number): TData[];
  hasLoadedPage(pageNo: number): boolean;
  loadPage(pageNo: number, rows: readonly TData[]): void;
  loadScopePage(scopeKey: string, pageNo: number, rows: readonly TData[]): void;
  acceptChanges(
    changes: readonly DataTableCellChange<TData>[],
    serverRows?: readonly TData[],
    options?: DataTableAcceptChangesOptions
  ): void;
  discardChanges(): void;
  reset(): void;
}

/** 管理跨页基础行、已提交草稿、scope 切换与持久化确认。 */
export function useDataTableEditingRows<TData>(
  store: DataTableEditingStore<TData>,
  errors: DataTableEditingErrors<TData>
): DataTableEditingRows<TData> {
  const getCommittedRow = React.useCallback(
    (rowId: string): TData | undefined => {
      const baseRow = store.baseRowsByIdRef.current.get(rowId);
      if (!baseRow) return undefined;
      return store.draftRowsByIdRef.current.get(rowId) ?? baseRow;
    },
    [store]
  );

  const getDisplayRow = React.useCallback(
    (rowId: string): TData | undefined => {
      const committedRow = getCommittedRow(rowId);
      if (!committedRow) return undefined;
      const activeCell = store.activeCellRef.current;
      if (activeCell?.rowId !== rowId || activeCell.parseState !== 'valid') {
        return committedRow;
      }

      const row = cloneRow(committedRow);
      setRowField(row, activeCell.field, activeCell.candidateValue);
      return row;
    },
    [getCommittedRow, store]
  );

  const rowHasChanges = React.useCallback(
    (rowId: string) => {
      const baseRow = store.baseRowsByIdRef.current.get(rowId);
      const committedRow = getCommittedRow(rowId);
      if (!baseRow || !committedRow) return false;

      for (const field of store.editableFieldsRef.current.keys()) {
        if (!areEditableValuesEqual(baseRow[field], committedRow[field])) return true;
      }
      return false;
    },
    [getCommittedRow, store]
  );

  const getSnapshot = React.useCallback((): DataTableEditSnapshot<TData> => {
    const loadedPages = [...store.loadedPageRowIdsRef.current.keys()].toSorted(
      (left, right) => left - right
    );
    const rows: TData[] = [];
    const changedRows: TData[] = [];
    const changes: DataTableCellChange<TData>[] = [];
    const emittedRowIds = new Set<string>();

    for (const pageNo of loadedPages) {
      const rowIds = store.loadedPageRowIdsRef.current.get(pageNo) ?? [];
      for (const rowId of rowIds) {
        if (
          emittedRowIds.has(rowId) ||
          store.latestRowLocationRef.current.get(rowId)?.pageNo !== pageNo
        ) {
          continue;
        }

        const baseRow = store.baseRowsByIdRef.current.get(rowId);
        const committedRow = getCommittedRow(rowId);
        if (!baseRow || !committedRow) continue;
        emittedRowIds.add(rowId);
        rows.push(committedRow);

        let changed = false;
        for (const field of store.editableFieldsRef.current.keys()) {
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
  }, [getCommittedRow, store]);

  const getRowsForPage = React.useCallback(
    (pageNo: number) => {
      const rows: TData[] = [];
      for (const rowId of store.loadedPageRowIdsRef.current.get(pageNo) ?? []) {
        if (store.latestRowLocationRef.current.get(rowId)?.pageNo !== pageNo) continue;
        const row = getDisplayRow(rowId);
        if (row) rows.push(row);
      }
      return rows;
    },
    [getDisplayRow, store]
  );

  const hasLoadedPage = React.useCallback(
    (pageNo: number) => store.loadedPageRowIdsRef.current.has(pageNo),
    [store]
  );

  const loadPage = React.useCallback(
    (pageNo: number, rows: readonly TData[]) => {
      store.sequenceRef.current += 1;
      const sequence = store.sequenceRef.current;
      const rowIds: string[] = [];
      let stateChanged = false;
      let serverErrorsChanged = false;
      const refreshedCells: Array<{ rowId: string; field: EditableField<TData> }> = [];

      rows.forEach((serverRow, index) => {
        const rowId = store.getRowIdRef.current(serverRow, index);
        const previousBase = store.baseRowsByIdRef.current.get(rowId);
        const previousDraft = store.draftRowsByIdRef.current.get(rowId);
        const previousLocation = store.latestRowLocationRef.current.get(rowId);
        const previousCommitted = getCommittedRow(rowId);
        const nextBase = cloneRow(serverRow);
        const nextDraft = cloneRow(nextBase);
        let hasDraft = false;

        if (previousBase && previousCommitted) {
          for (const field of store.editableFieldsRef.current.keys()) {
            const previousValue = previousCommitted[field];
            if (areEditableValuesEqual(previousBase[field], previousValue)) continue;
            nextDraft[field] = previousValue;
            if (!areEditableValuesEqual(nextBase[field], nextDraft[field])) hasDraft = true;
          }
        }

        store.baseRowsByIdRef.current.set(rowId, nextBase);
        if (hasDraft) store.draftRowsByIdRef.current.set(rowId, nextDraft);
        else store.draftRowsByIdRef.current.delete(rowId);
        if (previousBase) {
          for (const field of store.editableFieldsRef.current.keys()) {
            refreshedCells.push({ rowId, field });
            const retainsLocalDraft = !areEditableValuesEqual(nextBase[field], nextDraft[field]);
            if (!retainsLocalDraft) {
              serverErrorsChanged =
                errors.clearServerCellErrorValue(rowId, field) || serverErrorsChanged;
            }
          }
        }
        store.latestRowLocationRef.current.set(rowId, { pageNo, sequence });
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
      const previousRowIds = store.loadedPageRowIdsRef.current.get(pageNo);
      store.loadedPageRowIdsRef.current.set(pageNo, nextRowIds);
      for (const removedRowId of previousRowIds ?? []) {
        if (nextRowIds.includes(removedRowId)) continue;
        const remainsLoaded = [...store.loadedPageRowIdsRef.current.values()].some((pageRowIds) =>
          pageRowIds.includes(removedRowId)
        );
        if (remainsLoaded) continue;
        for (const [key, error] of store.serverCellErrorsByKeyRef.current) {
          if (error.rowId !== removedRowId) continue;
          store.serverCellErrorsByKeyRef.current.delete(key);
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
        const revision = store.advanceRevision();
        for (const { rowId, field } of refreshedCells) {
          errors.markCellRevision(rowId, field, revision);
        }
      }
      if (stateChanged || serverErrorsChanged) {
        store.notify();
      }
    },
    [errors, getCommittedRow, store]
  );

  const acceptChanges = React.useCallback(
    (
      changes: readonly DataTableCellChange<TData>[],
      serverRows?: readonly TData[],
      acceptOptions?: DataTableAcceptChangesOptions
    ) => {
      const serverRowsById = new Map<string, TData>();
      serverRows?.forEach((row, index) => {
        serverRowsById.set(store.getRowIdRef.current(row, index), row);
      });
      const changesByRowId = new Map<string, DataTableCellChange<TData>[]>();
      for (const change of changes) {
        const rowChanges = changesByRowId.get(change.rowId) ?? [];
        rowChanges.push(change);
        changesByRowId.set(change.rowId, rowChanges);
      }

      for (const [rowId, rowChanges] of changesByRowId) {
        const previousBase = store.baseRowsByIdRef.current.get(rowId);
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
        for (const field of store.editableFieldsRef.current.keys()) {
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

        store.baseRowsByIdRef.current.set(rowId, nextBase);
        if (hasDraft) store.draftRowsByIdRef.current.set(rowId, nextDraft);
        else store.draftRowsByIdRef.current.delete(rowId);
      }
      const revision = store.advanceRevision();
      for (const change of changes) {
        if (
          acceptOptions?.revision !== undefined &&
          !errors.canApplyServerCellResult(change.rowId, change.field, acceptOptions.revision)
        ) {
          continue;
        }
        errors.clearServerCellErrorValue(change.rowId, change.field);
        errors.markCellRevision(change.rowId, change.field, acceptOptions?.revision ?? revision);
      }
      store.notify();
    },
    [errors, getCommittedRow, store]
  );

  const discardChanges = React.useCallback(() => {
    store.draftRowsByIdRef.current.clear();
    store.serverCellErrorsByKeyRef.current.clear();
    store.cellRevisionByKeyRef.current.clear();
    store.activeCellRef.current = null;
    store.readyCellRef.current = null;
    store.editorAnchorRef.current = null;
    store.advanceRevision();
    store.notify();
  }, [store]);

  const reset = React.useCallback(() => {
    store.baseRowsByIdRef.current.clear();
    store.draftRowsByIdRef.current.clear();
    store.serverCellErrorsByKeyRef.current.clear();
    store.cellRevisionByKeyRef.current.clear();
    store.loadedPageRowIdsRef.current.clear();
    store.latestRowLocationRef.current.clear();
    store.activeCellRef.current = null;
    store.readyCellRef.current = null;
    store.editorAnchorRef.current = null;
    store.advanceRevision();
    store.notify();
  }, [store]);

  const loadScopePage = React.useCallback(
    (scopeKey: string, pageNo: number, rows: readonly TData[]) => {
      if (store.scopeKeyRef.current !== scopeKey) {
        store.baseRowsByIdRef.current.clear();
        store.draftRowsByIdRef.current.clear();
        store.serverCellErrorsByKeyRef.current.clear();
        store.cellRevisionByKeyRef.current.clear();
        store.loadedPageRowIdsRef.current.clear();
        store.latestRowLocationRef.current.clear();
        store.activeCellRef.current = null;
        store.readyCellRef.current = null;
        store.editorAnchorRef.current = null;
        store.scopeKeyRef.current = scopeKey;
        store.advanceRevision();
      }
      loadPage(pageNo, rows);
    },
    [loadPage, store]
  );

  return React.useMemo(
    () => ({
      getCommittedRow,
      getDisplayRow,
      rowHasChanges,
      getSnapshot,
      getRowsForPage,
      hasLoadedPage,
      loadPage,
      loadScopePage,
      acceptChanges,
      discardChanges,
      reset
    }),
    [
      acceptChanges,
      discardChanges,
      getCommittedRow,
      getDisplayRow,
      getRowsForPage,
      getSnapshot,
      hasLoadedPage,
      loadPage,
      loadScopePage,
      reset,
      rowHasChanges
    ]
  );
}
