import type {
  DataTableActiveEditingCell,
  DataTableEditChangeReason,
  DataTableEditableColumnMeta,
  DataTableEditingCellCoordinate,
  DataTableEditingOptions,
  DataTableServerCellErrorState
} from '../types';

export type EditableField<TData> = Extract<keyof TData, string>;

export type DataTableCellUpdate<TData> = {
  [K in EditableField<TData>]: {
    rowId: string;
    field: K;
    value: TData[K];
    reason: DataTableEditChangeReason;
  };
}[EditableField<TData>];

export type UseDataTableEditingOptions<TData> = {
  tableId: string;
  editableFields: ReadonlyMap<EditableField<TData>, DataTableEditableColumnMeta<TData>>;
  getRowId: (row: TData, index: number) => string;
  options?: DataTableEditingOptions<TData>;
};

export type LatestRowLocation = {
  pageNo: number;
  sequence: number;
};

export type EditorAnchorRegistration = {
  sessionId: number;
  token: symbol;
};

type MutableRef<T> = {
  current: T;
};

export interface DataTableEditingStore<TData> {
  baseRowsByIdRef: MutableRef<Map<string, TData>>;
  draftRowsByIdRef: MutableRef<Map<string, TData>>;
  loadedPageRowIdsRef: MutableRef<Map<number, string[]>>;
  latestRowLocationRef: MutableRef<Map<string, LatestRowLocation>>;
  scopeKeyRef: MutableRef<string | null>;
  sequenceRef: MutableRef<number>;
  revisionRef: MutableRef<number>;
  cellRevisionByKeyRef: MutableRef<Map<string, number>>;
  serverCellErrorsByKeyRef: MutableRef<Map<string, DataTableServerCellErrorState<TData>>>;
  editingSessionSequenceRef: MutableRef<number>;
  activeCellRef: MutableRef<DataTableActiveEditingCell<TData> | null>;
  readyCellRef: MutableRef<DataTableEditingCellCoordinate | null>;
  editorAnchorRef: MutableRef<EditorAnchorRegistration | null>;
  optionsRef: MutableRef<DataTableEditingOptions<TData> | undefined>;
  editableFieldsRef: MutableRef<
    ReadonlyMap<EditableField<TData>, DataTableEditableColumnMeta<TData>>
  >;
  getRowIdRef: MutableRef<(row: TData, index: number) => string>;
  notify(): void;
  advanceRevision(): number;
}
