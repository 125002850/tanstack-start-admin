import type {
  CellContext,
  Column,
  ColumnSort,
  PaginationState,
  RowData,
  Table
} from '@tanstack/react-table';

/**
 * DataTable 共享类型定义。
 *
 * 这里扩展 TanStack Table 的 ColumnMeta/TableMeta，并定义 DSL、列类型、行操作、展开面板、
 * 虚拟化等跨组件共享的类型契约。
 */
declare module '@tanstack/react-table' {
  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface ColumnMeta<TData extends RowData, TValue> {
    /** 列面板、拖拽 overlay 和兜底展示使用的人类可读列名。 */
    label?: string;
    /** 筛选输入占位文案。 */
    placeholder?: string;
    /** DataTableToolbar 用于选择筛选控件的类型。 */
    variant?: FilterVariant;
    /** 表头“当前页筛选”的独立配置，不参与服务端查询或 TanStack columnFilters。 */
    localFilter?: DataTableLocalFilterMeta<TData>;
    /** useDslDataTable 读取的后端查询序列化配置。 */
    query?: {
      operator?: DataTableDslOperator;
      filterField?: string;
      sortField?: string;
      serializeFilter?: (value: unknown, column: Column<TData, TValue>) => unknown;
    };
    /** select/multiSelect/enum 列的可选项；tree 等形态由 DataTableFilterOptions 显式声明。 */
    options?: DataTableFilterOptions;
    /** editableField 生成的通用编辑器契约。 */
    editableCell?: DataTableEditableColumnMeta<TData>;
    /** 选择编辑器兼容契约；新运行时优先读取 editableCell。 */
    editableChoice?: DataTableEditableChoiceColumnMeta<TData>;
    /** range 筛选的数值边界。 */
    range?: [number, number];
    /** 数值筛选或展示的单位。 */
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
    /** 固定列边界阴影，可按 left/right 覆盖默认阴影。 */
    pinningShadow?: Partial<Record<'left' | 'right', string>>;
    /** 单元格自己负责 Tooltip 时设置为 true，避免外层重复包裹。 */
    cellOwnsTooltip?: boolean;
    /** 单元格复制时使用的值，优先于 DOM innerText。 */
    copyValue?: (value: TValue, row: TData) => unknown;
    /** 预留：列头菜单是否可见。 */
    columnMenuVisible?: boolean;
    /** “显示列”面板是否展示该列。 */
    columnPanelVisible?: boolean;
    /** “显示列”面板中是否允许拖拽重排该列。 */
    columnPanelReorder?: boolean;
  }

  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface TableMeta<TData extends RowData> {
    /** 序号列显示模式。 */
    rowNumberDisplayMode?: 'static' | 'original';
    /** 序号列使用的分页状态，渲染中用于保持编号稳定。 */
    rowNumberPagination?: PaginationState;
    /** 列面板重置顺序所需的状态和回调。 */
    dataTableColumnOrder?: DataTableColumnOrderMeta;
    /** DataTable 是否展示斑马纹。 */
    enableZebraStriping?: boolean;
    /** 远程选项 query key 使用的稳定表格标识。 */
    dataTableId?: string;
    /** DataTable 可编辑单元格的运行时状态与操作。 */
    dataTableEditing?: DataTableEditingRuntime<TData>;
    /** 表头“当前页筛选”的独立运行时；不会写入 TanStack columnFilters。 */
    dataTableLocalFiltering?: DataTableLocalFilteringRuntime;
    /** useDataTable 声明的行操作语义；实际 UI 由 DataTable 渲染层消费。 */
    dataTableRowActions?: DataTableRowAction<TData>[];
  }
}

/** 筛选选项和 enum 展示选项的通用结构。 */
export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

/** 树形选项：depth 必填，是层级数据而非组件开关。 */
export interface TreeOption extends Option {
  depth: number;
}

export type DataTableTreeSelectionMode = 'cascade' | 'independent';

/** 裸数组表示 flat；带 kind 的对象显式声明树形筛选及其选择语义。 */
export type DataTableFilterOptions =
  | readonly Option[]
  | {
      kind: 'tree';
      options: readonly TreeOption[];
      selectionMode?: DataTableTreeSelectionMode;
    };

/** Array.isArray 无法收窄 readonly 数组，统一通过此守卫识别 flat 选项。 */
export function isDataTableFlatFilterOptions(
  value: DataTableFilterOptions | undefined
): value is readonly Option[] {
  return Array.isArray(value);
}

export type DataTableChoiceValue = string | number;

export interface DataTableChoiceOption<TValue extends DataTableChoiceValue = DataTableChoiceValue> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

export interface DataTableRemoteOptionPage<TValue extends DataTableChoiceValue> {
  items: DataTableChoiceOption<TValue>[];
  total?: number;
}

export interface DataTableRemoteOptions<TValue extends DataTableChoiceValue> {
  loadOptions(params: {
    keyword: string;
    pageNo: number;
    pageSize: number;
    signal: AbortSignal;
  }): Promise<DataTableRemoteOptionPage<TValue>>;
  resolveOptions?(params: {
    values: readonly TValue[];
    signal: AbortSignal;
  }): Promise<DataTableChoiceOption<TValue>[]>;
  debounceMs?: number;
  pageSize?: number;
}

export type DataTableEditableChoiceType = 'enum' | 'select' | 'remoteSelect';
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
  | {
      status: 'valid';
      value: TValue;
    }
  | {
      status: 'invalid';
      errors: string[];
    };

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
  (
    | {
        valueKind: 'instant';
        timeZone?: string;
      }
    | {
        valueKind: 'local';
        timeZone?: never;
      }
  );

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
  | {
      kind: 'raw-draft';
      value: unknown;
    }
  | {
      kind: 'typed-candidate';
      value: TValue;
    };

export type DataTableProgrammaticEditRequest<TData> = {
  [K in Extract<keyof TData, string>]: {
    rowId: string;
    field: K;
    input: DataTableProgrammaticEditInput<TData[K]>;
  };
}[Extract<keyof TData, string>];

export type DataTableServerCellErrorCoordinate<TData> = {
  [K in Extract<keyof TData, string>]: {
    rowId: string;
    field: K;
  };
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
  | {
      parseState: 'unparsed';
      candidateValue?: never;
      validationErrors: [];
    }
  | {
      parseState: 'valid';
      candidateValue: unknown;
      validationErrors: [];
    }
  | {
      parseState: 'invalid';
      candidateValue?: unknown;
      validationErrors: string[];
    };

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
  | {
      status: 'committed';
    }
  | {
      status: 'unchanged';
    }
  | {
      status: 'blocked';
      errors: string[];
    }
  | {
      status: 'reverted';
      reason: 'invalid-edit' | 'virtualization-detach' | 'explicit-confirm-detach';
      errors?: string[];
    }
  | {
      status: 'stale-session';
    };

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

export type FilterOperator =
  | 'iLike'
  | 'notILike'
  | 'eq'
  | 'ne'
  | 'inArray'
  | 'notInArray'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'isBetween'
  | 'isRelativeToToday';

export type FilterVariant =
  | 'text'
  | 'number'
  | 'range'
  | 'date'
  | 'dateRange'
  | 'boolean'
  | 'select'
  | 'multiSelect';
export type DataTableDslOperator =
  | 'EQ'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'BETWEEN';

export type DataTableColumnFilterVariant =
  | 'text'
  | 'select'
  | 'multiSelect'
  | 'date'
  | 'dateRange'
  | 'number'
  | 'numberRange'
  | 'boolean';

/** 表头本地筛选控件配置；与服务端搜索栏使用的扁平 meta 字段完全隔离。 */
export interface DataTableLocalFilterMeta<TData = unknown> {
  variant: FilterVariant;
  placeholder?: string;
  options?: Option[];
  range?: [number, number];
  unit?: string;
  /** 将原始字段值转换成 Set Filter 候选项文案。 */
  formatValue?: (value: unknown, row: TData) => unknown;
}

/** Set Filter 候选项；key 保留原始值类型，label 只负责展示与搜索。 */
export interface DataTableLocalFilterOption {
  key: string;
  label: string;
}

/** undefined 表示全选/未筛选，空 selectedKeys 表示明确不选择任何值。 */
export interface DataTableLocalSetFilterValue {
  kind: 'set';
  selectedKeys: string[];
}

/** 表头本地筛选状态；只作用于当前已经加载到浏览器的数据。 */
export interface DataTableLocalColumnFilter {
  id: string;
  value: DataTableLocalSetFilterValue;
}

/** 表头本地筛选运行时，由 useDataTable 注入 TableMeta 供列头控件消费。 */
export interface DataTableLocalFilteringRuntime {
  filters: readonly DataTableLocalColumnFilter[];
  getFilterOptions: (columnId: string) => readonly DataTableLocalFilterOption[];
  getFilterValue: (columnId: string) => DataTableLocalSetFilterValue | undefined;
  setFilterValue: (columnId: string, value: DataTableLocalSetFilterValue | undefined) => void;
  reset: () => void;
}

export type DataTableFilterOption = Option;

export interface DataTableColumnFilterOptions {
  /** false 表示关闭服务端搜索筛选；字符串值表示搜索栏控件类型。 */
  filter?: false | DataTableColumnFilterVariant;
  filterPlaceholder?: string;
  filterOptions?: DataTableFilterOptions;
  filterMin?: number | Date;
  filterMax?: number | Date;
  filterUnit?: string;
  /** 表头当前页筛选；默认按字段 type 推导，false 可单独关闭。 */
  localFilter?: false | DataTableColumnFilterVariant;
  localFilterPlaceholder?: string;
  localFilterOptions?: readonly DataTableFilterOption[];
  localFilterMin?: number;
  localFilterMax?: number;
  localFilterUnit?: string;
}

export interface DataTableColumnDslQueryOptions<TData, TValue> {
  /** 后端 DSL 查询字段、排序字段、操作符和自定义序列化函数。 */
  dsl?: {
    filterField?: string;
    sortField?: string;
    filterOperator?: DataTableDslOperator;
    serializeFilter?: (value: unknown, column: Column<TData, TValue>) => unknown;
  };
}

export interface DataTableColumnPanelOptions {
  columnMenuVisible?: boolean;
  columnPanelVisible?: boolean;
  columnPanelReorder?: boolean;
}

export type BuiltInColumnValueType =
  | 'text'
  | 'longText'
  | 'number'
  | 'int'
  | 'decimal'
  | 'money'
  | 'percent'
  | 'date'
  | 'dateTime'
  | 'boolean'
  | 'enum'
  | 'select'
  | 'remoteSelect'
  | 'fileSize';

export type DataTableColumnValueType = BuiltInColumnValueType | (string & {});

export type DataTableColumnAlign = 'left' | 'center' | 'right';

export interface DataTableColumnTypeDefinition<TData, TValue> {
  /** 将原始字段值转换为展示内容。 */
  formatValue?: (value: TValue, row: TData) => React.ReactNode;
  /** 将原始字段值转换为复制内容。 */
  copyValue?: (value: TValue, row: TData) => unknown;
  /** 完整接管 cell 渲染。 */
  renderCell?: (context: CellContext<TData, TValue>) => React.ReactNode;
  size?: number;
  minSize?: number;
  maxSize?: number;
  align?: DataTableColumnAlign;
  /** 表头文字对齐；未声明时统一居中，不跟随单元格对齐。 */
  headerAlign?: DataTableColumnAlign;
  cellClassName?: string;
  headerClassName?: string;
}

/** 每个表格操作回调收到的上下文；selectedRows 默认只代表当前已加载页。 */
export interface DataTableActionContext<TData> {
  table: Table<TData>;
  selectedRows: TData[];
}

export type DataTableActionResolver<TData, TValue> =
  | TValue
  | ((ctx: DataTableActionContext<TData>) => TValue);

interface DataTableActionBase<TData> {
  label: string;
  icon?: React.ReactNode;
  type?: 'default' | 'danger';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: DataTableActionResolver<TData, boolean>;
  className?: DataTableActionResolver<TData, string>;
  callback?: (ctx: DataTableActionContext<TData>) => void | Promise<void>;
  children?: DataTableAction<TData>[];
}

export interface DataTableRegularAction<TData> extends DataTableActionBase<TData> {
  kind?: 'regular';
  hidden?: DataTableActionResolver<TData, boolean>;
}

export interface DataTableSelectionAction<TData> extends DataTableActionBase<TData> {
  kind: 'selection';
  hidden?: never;
}

export type DataTableAction<TData> =
  | DataTableRegularAction<TData>
  | DataTableSelectionAction<TData>;

/** 行操作的纯语义契约；Sheet 由内部行操作渲染器负责挂载。 */
export interface DataTableRowAction<TData> {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean | ((row: TData) => boolean);
  hidden?: boolean | ((row: TData) => boolean);
  /** 事件返回值由表格忽略；异步处理器也可直接传入。 */
  onClick?: (row: TData) => void;
  confirmDelete?: {
    title?: string;
    description?: (row: TData) => string;
    confirmText?: string;
    cancelText?: string;
  };
  Sheet?: React.ComponentType<{
    data: TData;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>;
}

/** columnDsl.audit() 接受的通用审计字段契约。 */
export interface DataTableAuditFields {
  createById?: number | null;
  createByName?: string | null;
  createTime?: string | null;
  updateById?: number | null;
  updateByName?: string | null;
  updateTime?: string | null;
}

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, 'id'> {
  id: Extract<keyof TData, string>;
}

export type DataTableStateStorageMode = 'localStorage' | 'sessionStorage' | false;
export type ColumnResizeStorageMode = DataTableStateStorageMode;
export type ColumnOrderStorageMode = DataTableStateStorageMode;
export type SortingStorageMode = DataTableStateStorageMode;

export interface DataTableColumnOrderMeta {
  hasCustomOrder: boolean;
  reset: () => void;
}

/** 只允许 string/number 字段作为展开行 key，保证可稳定序列化。 */
export type ExpandRowKeyField<TData> = Extract<
  {
    [K in keyof TData]-?: TData[K] extends string | number ? K : never;
  }[keyof TData],
  string
>;

export interface ExpandTab<TData, TId extends string = string> {
  id: TId;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean | ((row: TData) => boolean);
  render: (row: TData) => React.ReactNode;
}

export interface ExpandTableSizing {
  /** 展开后主表区域的初始高度。 */
  initialHeight: number;
  /** 主表区域最小高度。 */
  minHeight?: number;
  /** 主表区域最大高度。 */
  maxHeight?: number;
}

export interface ExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  TTabs extends readonly ExpandTab<TData, string>[]
> {
  rowKey: TKey;
  tabs: TTabs;
  defaultTab?: TTabs[number]['id'];
  tableSizing?: ExpandTableSizing;
}

export interface ExpandTabEdge<TData> extends Omit<ExpandTab<TData, string>, 'id'> {
  id: string;
}

export interface ExpandConfigEdge<TData> {
  rowKey: keyof TData & string;
  tabs: readonly ExpandTabEdge<TData>[];
  defaultTab?: string;
  tableSizing?: ExpandTableSizing;
}

export function defineExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  const TTabs extends readonly ExpandTab<TData, string>[]
>(config: ExpandConfig<TData, TKey, TTabs>) {
  // 纯类型 helper：保留 tabs id 字面量类型，运行时直接返回原配置。
  return config;
}

export type DataTableVirtualizationMode = 'auto' | 'on' | 'off';

export type DataTableVirtualizationFallbackReason =
  | 'runtime-error'
  | 'unsupported-browser'
  | 'disabled-by-config'
  | 'grouped-header'
  | 'header-colspan';

export interface DataTableVirtualizationOptions {
  /**
   * 控制行虚拟化启用方式：
   * - `auto`（默认）：遵守环境 gate 和 `rowCountThreshold`
   * - `on`：环境允许时强制启用，忽略小数据量阈值
   * - `off`：显式关闭
   */
  mode?: DataTableVirtualizationMode;
  /**
   * 旧 API 的兼容别名。
   * `enabled: false` 映射为 `mode: 'off'`；
   * `enabled: true` 映射为 auto，仍遵守行数阈值。
   */
  enabled?: boolean;
  /**
   * 控制中间列虚拟化启用方式：
   * - 省略 / `off`（默认）：保持完整列渲染路径
   * - `auto`：达到列数阈值时启用
   * - `on`：表头结构允许时强制启用
   */
  columnVirtualizationMode?: DataTableVirtualizationMode;
  estimateRowHeight?: number;
  overscan?: number;
  rowCountThreshold?: number;
  columnCountThreshold?: number;
  columnOverscan?: number;
  /**
   * 只有“调用方意图启用虚拟化，但被 gate 或运行时错误阻止”时触发。
   * 显式 `mode: 'off'` 不触发该回调。
   */
  onVirtualizationFallback?: (reason: DataTableVirtualizationFallbackReason) => void;
}

export interface DataTableResolvedColumnVirtualizationOptions {
  enabled: boolean;
  columnCountThreshold: number;
  overscan: number;
}

export interface DataTableResolvedVirtualizationOptions {
  enabled: boolean;
  estimateRowHeight?: number;
  overscan?: number;
  rowCountThreshold?: number;
  column: DataTableResolvedColumnVirtualizationOptions;
  onVirtualizationFallback?: (reason: DataTableVirtualizationFallbackReason) => void;
}

export type DataTableVirtualizationProp = boolean | DataTableVirtualizationOptions;

export interface DataTableColumnRenderItem<TData> {
  /** 列 ID。 */
  columnId: string;
  /** 在完整可见叶子列数组中的索引，用于从 row.getVisibleCells() 取 cell。 */
  leafIndex: number;
  /** 在中间区域列数组中的索引；固定列使用 -1。 */
  centerIndex: number;
  /** 当前渲染宽度。 */
  size: number;
  column: Column<TData>;
}

/** 列虚拟化窗口：固定列始终在 left/right，items 只包含中间可见窗口。 */
export interface DataTableColumnVirtualWindow<TData> {
  enabled: boolean;
  items: DataTableColumnRenderItem<TData>[];
  leftItems: DataTableColumnRenderItem<TData>[];
  rightItems: DataTableColumnRenderItem<TData>[];
  virtualPaddingLeft: number;
  virtualPaddingRight: number;
  virtualTotalSize: number;
}
