import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableEditableChoiceType,
  DataTableRemoteOptions
} from './choice/types';

export type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableEditableChoiceType,
  DataTableRemoteOptionPage,
  DataTableRemoteOptions
} from './choice/types';

export type DataTableEditableNumericType = 'number' | 'int' | 'decimal' | 'money' | 'percent';
export type DataTableDateValue = `${number}-${number}-${number}`;
export type PlannedEditableType =
  | 'text'
  | DataTableEditableChoiceType
  | 'longText'
  | DataTableEditableNumericType
  | 'date'
  | 'dateTime';
export type DataTableInvalidEditBehavior = 'block' | 'revert';
export type DataTableEditableCommitMode = 'blur' | 'explicit-confirm' | 'selection';

export type DataTableEditParseResult<TValue> =
  | { status: 'valid'; value: TValue }
  | { status: 'invalid'; errors: string[] };

export interface DataTableEditCodec<TData, TValue> {
  formatForEdit(value: TValue, row: TData): unknown;
  parse(draftValue: unknown, row: TData): DataTableEditParseResult<TValue>;
  validate(value: TValue, row: TData): string[];
}

export interface DataTableNumericEditOptions {
  allowEmpty?: boolean;
  emptyValue?: null | undefined;
  min?: number;
  max?: number;
  step?: number | 'any';
  maxFractionDigits?: number;
  allowScientificNotation?: boolean;
  preventStepping?: boolean;
  showStepperButtons?: boolean;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
}

export interface DataTableMoneyEditOptions extends DataTableNumericEditOptions {
  currency?: string;
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code';
  accounting?: boolean;
}

export interface DataTableDateEditOptions<TData = unknown> {
  allowEmpty?: boolean;
  emptyValue?: null;
  min?: string;
  max?: string;
  isDateUnavailable?: (value: string, row: TData) => boolean;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
}

export type DataTableDateTimeValueKind = 'instant' | 'local';
export type DataTableDateTimeGranularity = 'minute' | 'second';
export type DataTableTimeZoneSource = 'column' | 'table' | 'app';

export interface DataTableResolvedTimeZone {
  timeZone: string;
  source: DataTableTimeZoneSource;
}

type DataTableDateTimeEditBaseOptions = {
  granularity?: DataTableDateTimeGranularity;
  step?: number;
  hourCycle?: 12 | 24;
  defaultTime?: 'now' | '00:00' | string;
  min?: string;
  max?: string;
  allowEmpty?: boolean;
  emptyValue?: null;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
};

export type DataTableDateTimeEditOptions = DataTableDateTimeEditBaseOptions &
  ({ valueKind: 'instant'; timeZone?: string } | { valueKind: 'local'; timeZone?: never });

export interface DataTableTextareaEditOptions {
  control: 'textarea';
  allowEmpty?: boolean;
  emptyValue?: '' | null;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  cols?: number;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
}

export type DataTablePlannedEditableEditOptions = {
  longText: DataTableTextareaEditOptions;
  number: DataTableNumericEditOptions;
  int: DataTableNumericEditOptions;
  decimal: DataTableNumericEditOptions;
  money: DataTableMoneyEditOptions;
  percent: DataTableNumericEditOptions;
  date: DataTableDateEditOptions;
  dateTime: DataTableDateTimeEditOptions;
};

export type DataTableEditChangeReason =
  | 'blur'
  | 'enter'
  | 'tab'
  | 'selection'
  | 'paste'
  | 'delete'
  | 'fill'
  | 'programmatic'
  | 'virtualization-detach';

export type DataTableCellChange<TData> = {
  [K in Extract<keyof TData, string>]: {
    rowId: string;
    field: K;
    previousValue: TData[K];
    value: TData[K];
  };
}[Extract<keyof TData, string>];

export interface DataTableEditSnapshot<TData> {
  rows: TData[];
  changedRows: TData[];
  changes: DataTableCellChange<TData>[];
  loadedPages: number[];
}

export interface DataTableCellEditableContext<TData> {
  rowId: string;
  row: TData;
  columnId: string;
}

export interface DataTableEditChangeEvent<TData> {
  changes: DataTableCellChange<TData>[];
  snapshot: DataTableEditSnapshot<TData>;
  reason: DataTableEditChangeReason;
}

export interface DataTableEditingOptions<TData> {
  isCellEditable?: (context: DataTableCellEditableContext<TData>) => boolean;
  onChange?: (event: DataTableEditChangeEvent<TData>) => void;
}

export type DataTableProgrammaticEditInput<TValue> =
  | { kind: 'raw-draft'; value: unknown }
  | { kind: 'typed-candidate'; value: TValue };

export type DataTableProgrammaticEditRequest<TData> = {
  [K in Extract<keyof TData, string>]: {
    rowId: string;
    field: K;
    input: DataTableProgrammaticEditInput<TData[K]>;
  };
}[Extract<keyof TData, string>];

export type DataTableServerCellErrorCoordinate<TData> = {
  [K in Extract<keyof TData, string>]: { rowId: string; field: K };
}[Extract<keyof TData, string>];

export type DataTableServerCellError<TData> = DataTableServerCellErrorCoordinate<TData> & {
  messages: readonly string[];
  code?: string;
};

export type DataTableServerCellErrorState<TData> = DataTableServerCellError<TData> & {
  revision: number;
};

export interface DataTableServerCellErrorBatch<TData> {
  revision: number;
  errors: readonly DataTableServerCellError<TData>[];
}

export interface DataTableServerCellErrorClearRequest<TData> {
  revision?: number;
  cells?: readonly DataTableServerCellErrorCoordinate<TData>[];
}

export interface DataTableServerCellErrorMutationResult {
  applied: number;
  skipped: number;
}

export interface DataTableAcceptChangesOptions {
  revision?: number;
}

export interface DataTableEditingController<TData> {
  getRevision(): number;
  getSnapshot(): DataTableEditSnapshot<TData>;
  getServerCellErrors(): readonly DataTableServerCellErrorState<TData>[];
  hasChanges(): boolean;
  acceptChanges(
    changes: readonly DataTableCellChange<TData>[],
    serverRows?: readonly TData[],
    options?: DataTableAcceptChangesOptions
  ): void;
  discardChanges(): void;
  setServerCellErrors(
    batch: DataTableServerCellErrorBatch<TData>
  ): DataTableServerCellErrorMutationResult;
  clearServerCellErrors(
    request?: DataTableServerCellErrorClearRequest<TData>
  ): DataTableServerCellErrorMutationResult;
  writeCell(request: DataTableProgrammaticEditRequest<TData>): DataTableFinishEditingResult;
}

export interface DataTableResolvedEditableCell<TData, TValue = unknown> {
  field: Extract<keyof TData, string>;
  title: string;
  type: PlannedEditableType;
  editor: string;
  codec: DataTableEditCodec<TData, TValue>;
  invalidEditBehavior: DataTableInvalidEditBehavior;
  commitMode: DataTableEditableCommitMode;
}

export interface DataTableEditableTypeAdapter<
  TData,
  TValue,
  TEditOptions,
  TEditorKey extends string
> {
  editor: TEditorKey;
  createCodec(context: {
    edit: Readonly<TEditOptions>;
    tableTimeZone?: string;
    appTimeZone?: string;
  }): DataTableEditCodec<TData, TValue>;
  resolveMeta(context: {
    field: Extract<keyof TData, string>;
    title: string;
    edit: Readonly<TEditOptions>;
  }): Record<string, unknown>;
}

export type EditableTypeAdapterRegistry<TData> = Readonly<
  Partial<
    Record<PlannedEditableType, DataTableEditableTypeAdapter<TData, unknown, unknown, string>>
  >
>;

export type DataTableEditableChoiceColumnMeta<TData> = DataTableResolvedEditableCell<
  TData,
  DataTableChoiceValue | DataTableChoiceValue[] | null
> & {
  type: DataTableEditableChoiceType;
  editor: 'choice';
  selectionMode: 'single' | 'multiple';
  allowEmpty: boolean;
  maxSelected?: number;
  valueOptions?: readonly DataTableChoiceOption[];
  remoteOptions?: DataTableRemoteOptions<DataTableChoiceValue>;
};

export type DataTableEditableInputColumnMeta<TData> = DataTableResolvedEditableCell<
  TData,
  string | null | undefined
> & {
  type: 'text';
  editor: 'input';
  allowEmpty: boolean;
  inputType: 'text' | 'tel' | 'email' | 'url' | 'search';
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  placeholder?: string;
  maxLength?: number;
};

export type DataTableEditableTextareaColumnMeta<TData> = DataTableResolvedEditableCell<
  TData,
  string | null | undefined
> & {
  type: 'longText';
  editor: 'textarea';
  control: 'textarea';
  allowEmpty: boolean;
  emptyValue: '' | null;
  minLength?: number;
  maxLength?: number;
  rows: number;
  cols?: number;
};

export type DataTableEditableNumberColumnMeta<TData> = DataTableResolvedEditableCell<
  TData,
  number | null | undefined
> & {
  type: DataTableEditableNumericType;
  editor: 'number';
  allowEmpty: boolean;
  emptyValue: null | undefined;
  min?: number;
  max?: number;
  step: number | 'any';
  maxFractionDigits?: number;
  allowScientificNotation: boolean;
  preventStepping: boolean;
  showStepperButtons: boolean;
  prefix?: string;
  suffix?: string;
  currency?: string;
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code';
  accounting?: boolean;
};

export type DataTableEditableDateColumnMeta<TData> = DataTableResolvedEditableCell<
  TData,
  DataTableDateValue | null
> & {
  type: 'date';
  editor: 'date';
  allowEmpty: boolean;
  emptyValue: null;
  min?: DataTableDateValue;
  max?: DataTableDateValue;
  isDateUnavailable?: (value: DataTableDateValue, row: TData) => boolean;
};

export type DataTableEditableDateTimeColumnMeta<TData> = DataTableResolvedEditableCell<
  TData,
  string | null
> & {
  type: 'dateTime';
  editor: 'dateTime';
  valueKind: DataTableDateTimeValueKind;
  timeZone?: string;
  timeZoneSource?: DataTableTimeZoneSource;
  granularity: DataTableDateTimeGranularity;
  step: number;
  hourCycle: 12 | 24;
  defaultTime: 'now' | string;
  allowEmpty: boolean;
  emptyValue: null;
  min?: string;
  max?: string;
};

export type DataTableEditableSwitchColumnMeta<TData> = DataTableResolvedEditableCell<
  TData,
  DataTableChoiceValue | null
> & {
  type: 'enum' | 'select';
  editor: 'switch';
  allowEmpty: false;
  checkedValue: unknown;
  uncheckedValue: unknown;
  checkedLabel: string;
  uncheckedLabel: string;
};

export type DataTableEditableColumnMeta<TData> =
  | DataTableEditableChoiceColumnMeta<TData>
  | DataTableEditableInputColumnMeta<TData>
  | DataTableEditableTextareaColumnMeta<TData>
  | DataTableEditableNumberColumnMeta<TData>
  | DataTableEditableDateColumnMeta<TData>
  | DataTableEditableDateTimeColumnMeta<TData>
  | DataTableEditableSwitchColumnMeta<TData>;

export type DataTableActiveEditingParseState =
  | { parseState: 'unparsed'; candidateValue?: never; validationErrors: [] }
  | { parseState: 'valid'; candidateValue: unknown; validationErrors: [] }
  | { parseState: 'invalid'; candidateValue?: unknown; validationErrors: string[] };

interface DataTableActiveEditingCellBase<TData> extends DataTableCellEditableContext<TData> {
  sessionId: number;
  field: Extract<keyof TData, string>;
  initialValue: unknown;
  draftValue: unknown;
  editableCell: DataTableEditableColumnMeta<TData>;
}

export type DataTableActiveEditingCell<TData> = DataTableActiveEditingCellBase<TData> &
  DataTableActiveEditingParseState;

export interface DataTableEditingStartContext<TData> extends DataTableCellEditableContext<TData> {
  field: Extract<keyof TData, string>;
  initialValue: unknown;
  editableCell?: DataTableEditableColumnMeta<TData>;
}

export type DataTableFinishEditingResult =
  | { status: 'committed' }
  | { status: 'unchanged' }
  | { status: 'blocked'; errors: string[] }
  | {
      status: 'reverted';
      reason: 'invalid-edit' | 'virtualization-detach' | 'explicit-confirm-detach';
      errors?: string[];
    }
  | { status: 'stale-session' };

export type DataTableEditingCellCoordinate = Pick<
  DataTableCellEditableContext<unknown>,
  'rowId' | 'columnId'
>;

export interface DataTableCellCommit<TData> extends DataTableCellEditableContext<TData> {
  field: Extract<keyof TData, string>;
  value: unknown;
  editableCell: DataTableEditableColumnMeta<TData>;
}

export interface DataTableBatchCellCommit<TData> {
  rowId: string;
  columnId: string;
  field: Extract<keyof TData, string>;
  value: unknown;
  editableCell: DataTableEditableColumnMeta<TData>;
}

export interface DataTableBatchCommit<TData> {
  revision: number;
  commits: readonly DataTableBatchCellCommit<TData>[];
}

export interface DataTableCellEditInput<TData> extends DataTableCellEditableContext<TData> {
  field: Extract<keyof TData, string>;
  input: DataTableProgrammaticEditInput<unknown>;
  editableCell: DataTableEditableColumnMeta<TData>;
}

export interface DataTableEditorAnchorOptions {
  closePopup?: () => void;
}

export interface DataTableEditingRuntime<TData> {
  activeCell: DataTableActiveEditingCell<TData> | null;
  readyCell: DataTableEditingCellCoordinate | null;
  getRevision(): number;
  getServerCellError?(
    rowId: string,
    field: Extract<keyof TData, string>
  ): DataTableServerCellErrorState<TData> | undefined;
  isCellEditable(context: DataTableCellEditableContext<TData>): boolean;
  selectCell(context: DataTableCellEditableContext<TData>): void;
  clearCellSelection(): void;
  startEditing(context: DataTableEditingStartContext<TData>): number | null;
  setActiveDraft(sessionId: number, draftValue: unknown, options?: { parse?: boolean }): void;
  registerEditorAnchor(sessionId: number, options?: DataTableEditorAnchorOptions): () => void;
  finishEditing(sessionId: number, reason: DataTableEditChangeReason): DataTableFinishEditingResult;
  cancelEditing(sessionId: number): void;
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
