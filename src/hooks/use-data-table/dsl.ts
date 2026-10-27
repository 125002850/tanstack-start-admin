import { addDays, format, startOfDay } from 'date-fns';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState
} from '@tanstack/react-table';

import type { DataTableDslOperator, FilterVariant } from '@/types/data-table';
import { DATA_TABLE_EMPTY_FILTER_VALUE } from '@/lib/data-table/empty-filter';

/**
 * DataTable 服务端 DSL 请求构建器。
 *
 * 该文件把 TanStack Table 的 pagination/sorting/columnFilters 转换为后端分页 DSL：
 * pageNo/pageSize、condition 条件树和 sort 数组。它只支持项目明确约定的筛选类型。
 */
export interface PaginatedResponse<TData> {
  list?: TData[];
  total?: number;
}

export interface DataTableDslComposeCondition<TField extends string = string> {
  nodeType: 'compose';
  logic: 'AND' | 'OR';
  children: Array<DataTableDslCondition<TField>>;
}

export interface DataTableDslTextCondition<TField extends string = string> {
  nodeType: 'text';
  field: TField;
  op: Extract<
    DataTableDslOperator,
    | 'EQ'
    | 'NE'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'STARTS_WITH'
    | 'ENDS_WITH'
    | 'IN'
    | 'NOT_IN'
    | 'IS_NULL'
    | 'IS_NOT_NULL'
  >;
  value?: string;
  values?: string[];
}

export interface DataTableDslDateTimeCondition<TField extends string = string> {
  nodeType: 'dateTime';
  field: TField;
  op: Extract<
    DataTableDslOperator,
    'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN' | 'IS_NULL' | 'IS_NOT_NULL'
  >;
  value?: string;
  start?: string;
  end?: string;
}

export interface DataTableDslEnumCondition<TField extends string = string> {
  nodeType: 'enum';
  field: TField;
  op: Extract<DataTableDslOperator, 'EQ' | 'NE' | 'IN' | 'NOT_IN' | 'IS_NULL' | 'IS_NOT_NULL'>;
  value?: string | number;
  values?: Array<string | number>;
}

export interface DataTableDslBooleanCondition<TField extends string = string> {
  nodeType: 'boolean';
  field: TField;
  op: Extract<DataTableDslOperator, 'EQ' | 'NE' | 'IS_NULL' | 'IS_NOT_NULL'>;
  value?: boolean;
}

export interface DataTableDslNumberCondition<TField extends string = string> {
  nodeType: 'number';
  field: TField;
  op: Extract<
    DataTableDslOperator,
    'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN' | 'IS_NULL' | 'IS_NOT_NULL'
  >;
  value?: number;
  start?: number;
  end?: number;
}

/** Feature 模块通过声明合并注册后端专用条件，通用表格不依赖业务类型。 */
export interface DataTableDslConditionExtensions {}

export type DataTableDslCondition<TField extends string = string> =
  | DataTableDslComposeCondition<TField>
  | DataTableDslTextCondition<TField>
  | DataTableDslEnumCondition<TField>
  | DataTableDslBooleanCondition<TField>
  | DataTableDslDateTimeCondition<TField>
  | DataTableDslNumberCondition<TField>
  | DataTableDslConditionExtensions[keyof DataTableDslConditionExtensions];

export interface DataTableDslSortItem<TField extends string = string> {
  field: TField;
  direction: 'ASC' | 'DESC';
}

export interface DataTableDslPageRequestBase<TField extends string = string> {
  pageNo: number;
  pageSize: number;
  condition?: DataTableDslCondition<TField>;
  sort?: Array<DataTableDslSortItem<TField>>;
}

export type QueryOptionsFactory<
  TData,
  TRequest = DataTableDslPageRequestBase,
  TQueryData = PaginatedResponse<TData>,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey
> = (request: TRequest) => UseQueryOptions<TQueryData, TError, TQueryData, TQueryKey>;

const TEXT_VARIANT_OPERATORS = {
  text: ['EQ', 'NE', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH'] as const,
  select: ['EQ', 'NE'] as const,
  multiSelect: ['IN', 'NOT_IN'] as const
} satisfies Partial<Record<FilterVariant, readonly DataTableDslOperator[]>>;

const DATE_VARIANT_OPERATORS = {
  date: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN'] as const,
  dateRange: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN'] as const
} satisfies Partial<Record<FilterVariant, readonly DataTableDslOperator[]>>;

const BOOLEAN_VARIANT_OPERATORS = {
  boolean: ['EQ', 'NE'] as const
} satisfies Partial<Record<FilterVariant, readonly DataTableDslOperator[]>>;

const NUMBER_VARIANT_OPERATORS = {
  number: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE'] as const,
  range: ['BETWEEN'] as const
} satisfies Partial<Record<FilterVariant, readonly DataTableDslOperator[]>>;

/** 自动 DSL 支持的快捷筛选控件；高级搜索使用相同的条件节点契约。 */
export const DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS = [
  'text',
  'select',
  'multiSelect',
  'boolean',
  'date',
  'dateRange',
  'number',
  'range'
] as const satisfies readonly FilterVariant[];

type SupportedFilterVariant = (typeof DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS)[number];

const DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANT_SET = new Set<FilterVariant>(
  DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS
);

const DATA_TABLE_DSL_MAX_SEMICOLON_TEXT_VALUES = 1000;

type BuildDataTableDslRequestOptions<TData> = {
  columns: Array<ColumnDef<TData>>;
  pagination: PaginationState;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  baseCondition?: DataTableDslCondition;
  advancedCondition?: DataTableDslCondition;
  defaultRequestSort?: Array<DataTableDslSortItem>;
};

type ResolvedColumn<TData> = {
  id: string;
  column: ColumnDef<TData>;
};

export interface DataTableDslQuickCondition {
  /** 复合快捷筛选的可序列化 UI 值，恢复后须与条件重新核对。 */
  filterValue?: unknown;
  columnId: string;
  condition: DataTableDslCondition;
}

function warn(message: string, details?: Record<string, unknown>) {
  console.warn(`[useDslDataTable.dsl] ${message}`, details ?? {});
}

/** 解析 ColumnDef 的稳定 ID；accessorFn 列必须显式 id，否则无法安全序列化查询字段。 */
function getColumnId<TData>(column: ColumnDef<TData>): string | null {
  if (typeof column.id === 'string' && column.id.length > 0) {
    return column.id;
  }

  if (
    'accessorKey' in column &&
    typeof column.accessorKey === 'string' &&
    column.accessorKey.length > 0
  ) {
    return column.accessorKey;
  }

  return null;
}

/** 建立 columnId -> ColumnDef 映射，并在开发环境提示无法序列化的 accessorFn 列。 */
function resolveColumns<TData>(
  columns: Array<ColumnDef<TData>>
): Map<string, ResolvedColumn<TData>> {
  const resolved = new Map<string, ResolvedColumn<TData>>();

  for (const column of columns) {
    const id = getColumnId(column);

    if (!id) {
      if (
        'accessorFn' in column &&
        typeof column.accessorFn === 'function' &&
        (column.enableColumnFilter !== false || column.enableSorting !== false)
      ) {
        warn('Skipping accessorFn column without explicit id for query serialization.', {
          header: column.header
        });
      }
      continue;
    }

    resolved.set(id, { id, column });
  }

  return resolved;
}

/** 将字符串/数字筛选值归一化为非空字符串。 */
function normalizeStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

/** 将单值或数组值归一化为字符串数组，并剔除空值。 */
function normalizeStringArray(value: unknown): string[] {
  let values: unknown[];

  if (Array.isArray(value)) {
    values = value;
  } else if (value === undefined || value === null) {
    values = [];
  } else {
    values = [value];
  }

  return values
    .map((item) => normalizeStringValue(item))
    .filter((item): item is string => Boolean(item));
}

/** 按英文分号拆分文本筛选多值；只有调用方确认 2 个及以上值时才改变 DSL 形态。 */
function splitSemicolonTextValues(value: string): string[] {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function limitSemicolonTextValues(values: string[], field: string): string[] {
  if (values.length <= DATA_TABLE_DSL_MAX_SEMICOLON_TEXT_VALUES) {
    return values;
  }

  warn('Truncating semicolon-separated IN text filter values.', {
    field,
    count: values.length,
    max: DATA_TABLE_DSL_MAX_SEMICOLON_TEXT_VALUES
  });

  return values.slice(0, DATA_TABLE_DSL_MAX_SEMICOLON_TEXT_VALUES);
}

/** 支持毫秒时间戳字符串/数字和可被 Date 解析的字符串。 */
function parseTimestamp(value: unknown): Date | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      const date = new Date(numeric);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

function parseBackendDateTimeTimestamp(dateTime: string | undefined) {
  if (!dateTime) return undefined;
  const parsed = new Date(dateTime.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
}

/** 后端 DSL 当前使用 `yyyy-MM-dd HH:mm:ss` 字符串，不携带时区偏移。 */
function formatDateTimeWithOffset(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

function toStartOfDay(date: Date): string {
  return formatDateTimeWithOffset(startOfDay(date));
}

function toNextDayStart(date: Date): string {
  return toStartOfDay(addDays(date, 1));
}

function buildDayRange(field: string, from: Date, to: Date): DataTableDslComposeCondition {
  // 次日零点使用开区间，保留结束日最后一秒内的小数精度。
  return {
    nodeType: 'compose',
    logic: 'AND',
    children: [
      { nodeType: 'dateTime', field, op: 'GTE', value: toStartOfDay(from) },
      { nodeType: 'dateTime', field, op: 'LT', value: toNextDayStart(to) }
    ]
  };
}

function getDefaultOperatorForVariant(variant: SupportedFilterVariant): DataTableDslOperator {
  // 默认操作符和筛选控件语义保持一致：文本模糊、单选等值、多选 IN、日期整天范围。
  switch (variant) {
    case 'text':
      return 'CONTAINS';
    case 'select':
      return 'EQ';
    case 'multiSelect':
      return 'IN';
    case 'boolean':
      return 'EQ';
    case 'number':
      return 'EQ';
    case 'range':
      return 'BETWEEN';
    case 'date':
    case 'dateRange':
      return 'BETWEEN';
  }
}

export function isDataTableDslOperatorCompatibleWithVariant(
  variant: FilterVariant,
  operator: DataTableDslOperator
): boolean {
  const allowed =
    TEXT_VARIANT_OPERATORS[variant as keyof typeof TEXT_VARIANT_OPERATORS] ??
    DATE_VARIANT_OPERATORS[variant as keyof typeof DATE_VARIANT_OPERATORS] ??
    BOOLEAN_VARIANT_OPERATORS[variant as keyof typeof BOOLEAN_VARIANT_OPERATORS];
  const numberAllowed = NUMBER_VARIANT_OPERATORS[variant as keyof typeof NUMBER_VARIANT_OPERATORS];

  return Boolean(
    (allowed as readonly DataTableDslOperator[] | undefined)?.includes(operator) ||
    (numberAllowed as readonly DataTableDslOperator[] | undefined)?.includes(operator)
  );
}

/** 判断筛选 variant 是否支持自动 DSL 序列化。 */
export function isDataTableDslFilterVariantSupported(
  variant: FilterVariant | undefined
): variant is SupportedFilterVariant {
  return Boolean(variant && DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANT_SET.has(variant));
}

function resolveOperator(
  variant: SupportedFilterVariant,
  operatorOverride: DataTableDslOperator | undefined,
  field: string
): DataTableDslOperator {
  const fallback = getDefaultOperatorForVariant(variant);

  if (!operatorOverride) {
    return fallback;
  }

  if (isDataTableDslOperatorCompatibleWithVariant(variant, operatorOverride)) {
    return operatorOverride;
  }

  warn('Ignoring incompatible operator override and falling back to the default operator.', {
    field,
    variant,
    operatorOverride,
    fallback
  });

  return fallback;
}

/** 将单个 column filter 转换为 DSL condition；空值或不支持类型返回 undefined。 */
function buildFilterCondition<TData>(
  filter: ColumnFiltersState[number],
  resolvedColumns: Map<string, ResolvedColumn<TData>>
): DataTableDslCondition | undefined {
  const resolvedColumn = resolvedColumns.get(filter.id);
  if (!resolvedColumn) {
    return undefined;
  }

  const meta = resolvedColumn.column.meta;
  const variant = meta?.variant;
  if (!isDataTableDslFilterVariantSupported(variant)) {
    return undefined;
  }

  if (meta?.emptyOption && (variant === 'select' || variant === 'multiSelect')) {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (values.includes(DATA_TABLE_EMPTY_FILTER_VALUE)) {
      if (meta.query?.filterNodeType === 'enum') {
        throw new Error(
          'filterEmptyOption requires text.IS_NULL; enum nodes only support EQ / IN.'
        );
      }
      const ordinaryValues = values.filter((value) => value !== DATA_TABLE_EMPTY_FILTER_VALUE);
      // 在 serializeFilter / 自定义 builder 之前移除 UI 保留值，保持普通值的原始类型。
      const ordinaryCondition = ordinaryValues.length
        ? buildFilterCondition({ ...filter, value: ordinaryValues }, resolvedColumns)
        : undefined;
      const emptyCondition: DataTableDslCondition = meta.query?.emptyFilterCondition ?? {
        nodeType: 'text',
        field: meta.query?.filterField ?? resolvedColumn.id,
        op: 'IS_NULL'
      };
      return ordinaryCondition
        ? { nodeType: 'compose', logic: 'OR', children: [ordinaryCondition, emptyCondition] }
        : emptyCondition;
    }
  }

  if (meta?.query?.buildFilterCondition) {
    return meta.query.buildFilterCondition(filter.value);
  }

  const field = meta?.query?.filterField ?? resolvedColumn.id;
  const filterValue = meta?.query?.serializeFilter
    ? // 列级 serializeFilter 可把 UI 值转换成后端需要的值，例如枚举 code 或时间戳。
      meta.query.serializeFilter(filter.value, resolvedColumn.column as never)
    : filter.value;
  const conditionType = meta?.query?.filterNodeType;

  if (variant === 'boolean') {
    const rawValue = Array.isArray(filterValue) ? filterValue[0] : filterValue;
    if (typeof rawValue === 'boolean') {
      return { nodeType: 'boolean', field, op: 'EQ', value: rawValue };
    }
    const value = normalizeStringArray(rawValue)[0];
    if (value !== 'true' && value !== 'false') return undefined;
    return { nodeType: 'boolean', field, op: 'EQ', value: value === 'true' };
  }

  if (variant === 'text' || variant === 'select') {
    const value =
      variant === 'select'
        ? normalizeStringArray(filterValue)[0]
        : normalizeStringValue(filterValue);
    if (!value) {
      return undefined;
    }

    const op = resolveOperator(variant, meta?.query?.operator, field);
    if (variant === 'text' && op === 'CONTAINS' && value.includes(';')) {
      const values = limitSemicolonTextValues(splitSemicolonTextValues(value), field);
      if (values.length === 0) {
        return undefined;
      }

      return { nodeType: 'text', field, op: 'IN', values };
    }

    if (conditionType === 'enum') {
      return { nodeType: 'enum', field, op: op as DataTableDslEnumCondition['op'], value };
    }
    return { nodeType: 'text', field, op: op as DataTableDslTextCondition['op'], value };
  }

  if (variant === 'multiSelect') {
    const values = normalizeStringArray(filterValue);
    if (values.length === 0) {
      return undefined;
    }

    const op = resolveOperator(variant, meta?.query?.operator, field);
    if (conditionType === 'enum') {
      return { nodeType: 'enum', field, op: op as DataTableDslEnumCondition['op'], values };
    }
    return { nodeType: 'text', field, op: op as DataTableDslTextCondition['op'], values };
  }

  if (variant === 'number' || variant === 'range')
    return buildNumericFilterCondition(variant, filterValue, field, meta?.query?.operator);

  return buildDateFilterCondition(variant, filterValue, field);
}

function buildNumericFilterCondition(
  variant: 'number' | 'range',
  filterValue: unknown,
  field: string,
  operator?: DataTableDslOperator
): DataTableDslCondition | undefined {
  if (variant === 'number') {
    const rawValue = Array.isArray(filterValue) ? filterValue[0] : filterValue;
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (rawValue === '' || rawValue === null || rawValue === undefined || !Number.isFinite(value))
      return undefined;
    const op = resolveOperator(variant, operator, field);
    return { nodeType: 'number', field, op: op as DataTableDslNumberCondition['op'], value };
  }

  if (variant === 'range') {
    const [startRaw, endRaw] = Array.isArray(filterValue) ? filterValue : [];
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (
      startRaw == null ||
      endRaw == null ||
      startRaw === '' ||
      endRaw === '' ||
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    )
      return undefined;
    return { nodeType: 'number', field, op: 'BETWEEN', start, end };
  }

  return undefined;
}

function buildDateFilterCondition(
  variant: string,
  filterValue: unknown,
  field: string
): DataTableDslCondition | undefined {
  if (variant === 'date') {
    const date = parseTimestamp(filterValue);
    if (!date) {
      return undefined;
    }

    return buildDayRange(field, date, date);
  }

  if (variant === 'dateRange') {
    const [fromRaw, toRaw] = Array.isArray(filterValue) ? filterValue : [filterValue, undefined];
    const from = parseTimestamp(fromRaw);
    const to = parseTimestamp(toRaw);

    if (!from && !to) {
      return undefined;
    }

    if (from && to) {
      return buildDayRange(field, from, to);
    }

    if (from) {
      return {
        // 只有开始日期时，转换为大于等于当天开始。
        nodeType: 'dateTime',
        field,
        op: 'GTE',
        value: toStartOfDay(from)
      };
    }

    return {
      // 只有结束日期时，也包含当天全部小数秒。
      nodeType: 'dateTime',
      field,
      op: 'LT',
      value: toNextDayStart(to!)
    };
  }

  return undefined;
}

/** 将快捷筛选序列化成可持久化的 columnId + DSL 条件。 */
export function buildDataTableDslQuickConditions<TData>(
  columns: Array<ColumnDef<TData>>,
  columnFilters: ColumnFiltersState
): DataTableDslQuickCondition[] {
  const resolvedColumns = resolveColumns(columns);
  return columnFilters.flatMap((filter) => {
    const condition = buildFilterCondition(filter, resolvedColumns);
    const meta = resolvedColumns.get(filter.id)?.column.meta;
    return condition
      ? [
          {
            columnId: filter.id,
            condition,
            ...(meta?.query?.buildFilterCondition ||
            meta?.emptyOption ||
            meta?.variant === 'date' ||
            meta?.variant === 'dateRange'
              ? { filterValue: filter.value }
              : {})
          }
        ]
      : [];
  });
}

/** 把查询方案里的快捷条件恢复为 TanStack columnFilters。任一条件失效时整体拒绝恢复。 */
export function restoreDataTableColumnFilters<TData>(
  columns: Array<ColumnDef<TData>>,
  quickConditions: DataTableDslQuickCondition[]
): ColumnFiltersState | undefined {
  const resolvedColumns = resolveColumns(columns);
  const restored: ColumnFiltersState = [];

  for (const item of quickConditions) {
    const resolved = resolvedColumns.get(item.columnId);
    if (!resolved) return undefined;
    const meta = resolved.column.meta;
    const variant = meta?.variant;
    if (!isDataTableDslFilterVariantSupported(variant)) return undefined;
    const expectedField = meta?.query?.filterField ?? item.columnId;
    const condition = item.condition;
    if ('filterValue' in item) {
      const rebuilt = buildFilterCondition(
        { id: item.columnId, value: item.filterValue },
        resolvedColumns
      );
      if (canonicalCondition(rebuilt) !== canonicalCondition(condition)) return undefined;
      restored.push({ id: item.columnId, value: item.filterValue });
      continue;
    }
    if (condition.nodeType === 'compose' || condition.field !== expectedField) return undefined;

    let value: unknown;
    switch (condition.nodeType) {
      case 'text':
        if (condition.op === 'IN' || condition.op === 'NOT_IN') {
          value = variant === 'text' ? condition.values?.join(';') : condition.values;
        } else {
          value = condition.value;
        }
        break;
      case 'enum':
        value =
          condition.op === 'IN' || condition.op === 'NOT_IN' ? condition.values : condition.value;
        break;
      case 'boolean':
        value = condition.value === undefined ? undefined : String(condition.value);
        break;
      case 'number':
        value = condition.op === 'BETWEEN' ? [condition.start, condition.end] : condition.value;
        break;
      case 'dateTime': {
        value =
          condition.op === 'BETWEEN'
            ? variant === 'date'
              ? parseBackendDateTimeTimestamp(condition.start)
              : [
                  parseBackendDateTimeTimestamp(condition.start),
                  parseBackendDateTimeTimestamp(condition.end)
                ]
            : variant === 'dateRange' && condition.op === 'LTE'
              ? [undefined, parseBackendDateTimeTimestamp(condition.value)]
              : parseBackendDateTimeTimestamp(condition.value);
        break;
      }
    }

    if (value === undefined) return undefined;
    const rebuilt = buildFilterCondition({ id: item.columnId, value }, resolvedColumns);
    if (!rebuilt) return undefined;
    // 旧方案使用当天 23:59:59 作为闭区间结束，恢复为同一日期后采用修正后的半开区间。
    const legacyDateRange =
      condition.nodeType === 'dateTime' &&
      (variant === 'date' || variant === 'dateRange') &&
      ((condition.op === 'BETWEEN' &&
        condition.start?.endsWith(' 00:00:00') &&
        condition.end?.endsWith(' 23:59:59')) ||
        (variant === 'dateRange' &&
          condition.op === 'LTE' &&
          condition.value?.endsWith(' 23:59:59')));
    if (canonicalCondition(rebuilt) !== canonicalCondition(condition) && !legacyDateRange)
      return undefined;
    restored.push({ id: item.columnId, value });
  }

  return restored;
}

/** 将 TanStack sorting 转换为后端 sort；没有有效排序时使用 defaultRequestSort。 */
function buildSort<TData>(
  sorting: SortingState,
  resolvedColumns: Map<string, ResolvedColumn<TData>>,
  defaultRequestSort?: Array<DataTableDslSortItem>
): Array<DataTableDslSortItem> | undefined {
  const items = sorting
    .map((sort) => {
      const resolvedColumn = resolvedColumns.get(sort.id);
      if (!resolvedColumn || resolvedColumn.column.enableSorting === false) {
        return undefined;
      }

      const field = resolvedColumn.column.meta?.query?.sortField ?? resolvedColumn.id;

      return {
        field,
        direction: sort.desc ? 'DESC' : 'ASC'
      } satisfies DataTableDslSortItem;
    })
    .filter((item): item is DataTableDslSortItem => Boolean(item));

  if (items.length > 0) return items;
  return defaultRequestSort && defaultRequestSort.length > 0 ? defaultRequestSort : undefined;
}

/** 把 baseCondition 和当前筛选条件合并成 AND 条件树。 */
function buildCondition<TData>({
  columnFilters,
  resolvedColumns,
  baseCondition,
  advancedCondition
}: {
  columnFilters: ColumnFiltersState;
  resolvedColumns: Map<string, ResolvedColumn<TData>>;
  baseCondition?: DataTableDslCondition;
  advancedCondition?: DataTableDslCondition;
}): DataTableDslCondition | undefined {
  const filterConditions = columnFilters
    .map((filter) => buildFilterCondition(filter, resolvedColumns))
    .filter((condition): condition is DataTableDslCondition => Boolean(condition));
  if (!baseCondition && !advancedCondition && filterConditions.length > 0) {
    return { nodeType: 'compose', logic: 'AND', children: filterConditions };
  }

  const allConditions = [baseCondition, ...filterConditions, advancedCondition].filter(
    (condition): condition is DataTableDslCondition => Boolean(condition)
  );

  if (allConditions.length === 0) return undefined;
  if (allConditions.length === 1) return allConditions[0];

  return {
    nodeType: 'compose',
    logic: 'AND',
    children: allConditions
  };
}

/** 构建最终分页 DSL 请求对象。 */
export function buildDataTableDslRequest<TData>({
  columns,
  pagination,
  sorting,
  columnFilters,
  baseCondition,
  advancedCondition,
  defaultRequestSort
}: BuildDataTableDslRequestOptions<TData>): DataTableDslPageRequestBase {
  const resolvedColumns = resolveColumns(columns);

  return {
    pageNo: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    condition: buildCondition({ columnFilters, resolvedColumns, baseCondition, advancedCondition }),
    sort: buildSort(sorting, resolvedColumns, defaultRequestSort)
  };
}

function canonicalCondition(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalCondition).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalCondition(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
