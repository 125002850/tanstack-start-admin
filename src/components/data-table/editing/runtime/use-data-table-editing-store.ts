import * as React from 'react';

import type {
  DataTableActiveEditingCell,
  DataTableEditingCellCoordinate,
  DataTableServerCellErrorState
} from '../types';

import type {
  DataTableEditingStore,
  EditorAnchorRegistration,
  LatestRowLocation,
  UseDataTableEditingOptions
} from './types';

/**
 * 编辑引擎的唯一可变状态容器。
 *
 * refs 保证 controller/runtime 方法同步读取最新值；reducer 只负责通知 React 重渲染，
 * 不参与 dirty、revision 或 session 的真相维护。
 */
export function useDataTableEditingStore<TData>({
  tableId,
  editableFields,
  getRowId,
  options
}: UseDataTableEditingOptions<TData>): DataTableEditingStore<TData> {
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

  return React.useMemo(
    () => ({
      baseRowsByIdRef,
      draftRowsByIdRef,
      loadedPageRowIdsRef,
      latestRowLocationRef,
      scopeKeyRef,
      sequenceRef,
      revisionRef,
      cellRevisionByKeyRef,
      serverCellErrorsByKeyRef,
      editingSessionSequenceRef,
      activeCellRef,
      readyCellRef,
      editorAnchorRef,
      optionsRef,
      editableFieldsRef,
      getRowIdRef,
      notify,
      advanceRevision
    }),
    [advanceRevision, notify]
  );
}
