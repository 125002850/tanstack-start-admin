import { endOfDay, format, startOfDay } from 'date-fns';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState
} from '@tanstack/react-table';

import type { DataTableDslOperator, FilterVariant } from '@/types/data-table';

/**
 * DataTable DSL 请求构建器。
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
  op: Extract<DataTableDslOperator, 'EQ' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'IN'>;
  value?: string;
  values?: string[];
}

export interface DataTableDslDateTimeCondition<TField extends string = string> {
  nodeType: 'dateTime';
  field: TField;
  op: Extract<DataTableDslOperator, 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN'>;
  value?: string;
  start?: string;
  end?: string;
}

export type DataTableDslCondition<TField extends string = string> =
  | DataTableDslComposeCondition<TField>
  | DataTableDslTextCondition<TField>
  | DataTableDslDateTimeCondition<TField>;

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
  text: ['EQ', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH'] as const,
  select: ['EQ'] as const,
  multiSelect: ['IN'] as const
} satisfies Partial<Record<FilterVariant, readonly DataTableDslOperator[]>>;

const DATE_VARIANT_OPERATORS = {
  date: ['GT', 'GTE', 'LT', 'LTE', 'BETWEEN'] as const,
  dateRange: ['GT', 'GTE', 'LT', 'LTE', 'BETWEEN'] as const
} satisfies Partial<Record<FilterVariant, readonly DataTableDslOperator[]>>;

/** 自动 DSL 当前只支持文本/枚举/日期类筛选，数值 range 等仅作为前端 UI 状态。 */
export const DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS = [
  'text',
  'select',
  'multiSelect',
  'date',
  'dateRange'
] as const satisfies readonly FilterVariant[];

type SupportedFilterVariant = (typeof DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS)[number];

const DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANT_SET = new Set<FilterVariant>(
  DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS
);

const MAX_SEMICOLON_TEXT_VALUES = 50;

type BuildDataTableDslRequestOptions<TData> = {
  columns: Array<ColumnDef<TData>>;
  pagination: PaginationState;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  baseCondition?: DataTableDslCondition;
  defaultRequestSort?: Array<DataTableDslSortItem>;
};

type ResolvedColumn<TData> = {
  id: string;
  column: ColumnDef<TData>;
};

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

/** 后端 DSL 当前使用 `yyyy-MM-dd HH:mm:ss` 字符串，不携带时区偏移。 */
function formatDateTimeWithOffset(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}

function toStartOfDay(date: Date): string {
  return formatDateTimeWithOffset(startOfDay(date));
}

function toEndOfDay(date: Date): string {
  return formatDateTimeWithOffset(endOfDay(date));
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
    DATE_VARIANT_OPERATORS[variant as keyof typeof DATE_VARIANT_OPERATORS];

  return Boolean((allowed as readonly DataTableDslOperator[] | undefined)?.includes(operator));
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

  const field = meta?.query?.filterField ?? resolvedColumn.id;
  const filterValue = meta?.query?.serializeFilter
    ? // 列级 serializeFilter 可把 UI 值转换成后端需要的值，例如枚举 code 或时间戳。
      meta.query.serializeFilter(filter.value, resolvedColumn.column as never)
    : filter.value;

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
      const values = splitSemicolonTextValues(value);
      if (values.length === 0) {
        return undefined;
      }

      const limitedValues =
        values.length > MAX_SEMICOLON_TEXT_VALUES
          ? values.slice(0, MAX_SEMICOLON_TEXT_VALUES)
          : values;

      if (values.length > MAX_SEMICOLON_TEXT_VALUES) {
        warn('Truncating semicolon-separated text filter values.', {
          field,
          count: values.length,
          max: MAX_SEMICOLON_TEXT_VALUES
        });
      }

      if (limitedValues.length >= 2) {
        return {
          nodeType: 'compose',
          logic: 'OR',
          children: limitedValues.map((item) => ({
            nodeType: 'text',
            field,
            op,
            value: item
          }))
        };
      }

      return { nodeType: 'text', field, op, value: limitedValues[0]! };
    }

    return { nodeType: 'text', field, op: op as DataTableDslTextCondition['op'], value };
  }

  if (variant === 'multiSelect') {
    const values = normalizeStringArray(filterValue);
    if (values.length === 0) {
      return undefined;
    }

    const op = resolveOperator(variant, meta?.query?.operator, field);
    return { nodeType: 'text', field, op: op as DataTableDslTextCondition['op'], values };
  }

  if (variant === 'date') {
    const date = parseTimestamp(filterValue);
    if (!date) {
      return undefined;
    }

    return {
      // 单日期按整天 BETWEEN 查询，避免只命中具体毫秒时间点。
      nodeType: 'dateTime',
      field,
      op: 'BETWEEN',
      start: toStartOfDay(date),
      end: toEndOfDay(date)
    };
  }

  if (variant === 'dateRange') {
    const [fromRaw, toRaw] = Array.isArray(filterValue) ? filterValue : [filterValue, undefined];
    const from = parseTimestamp(fromRaw);
    const to = parseTimestamp(toRaw);

    if (!from && !to) {
      return undefined;
    }

    if (from && to) {
      return {
        // 双端日期范围包含 from 当天开始到 to 当天结束。
        nodeType: 'dateTime',
        field,
        op: 'BETWEEN',
        start: toStartOfDay(from),
        end: toEndOfDay(to)
      };
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
      // 只有结束日期时，转换为小于等于当天结束。
      nodeType: 'dateTime',
      field,
      op: 'LTE',
      value: toEndOfDay(to!)
    };
  }

  return undefined;
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
  baseCondition
}: {
  columnFilters: ColumnFiltersState;
  resolvedColumns: Map<string, ResolvedColumn<TData>>;
  baseCondition?: DataTableDslCondition;
}): DataTableDslCondition | undefined {
  const filterConditions = columnFilters
    .map((filter) => buildFilterCondition(filter, resolvedColumns))
    .filter((condition): condition is DataTableDslCondition => Boolean(condition));

  if (filterConditions.length === 0) {
    // 无筛选时直接返回 baseCondition，避免多包一层空 compose。
    return baseCondition;
  }

  return {
    nodeType: 'compose',
    logic: 'AND',
    children: baseCondition ? [baseCondition, ...filterConditions] : filterConditions
  };
}

/** 构建最终分页 DSL 请求对象。 */
export function buildDataTableDslRequest<TData>({
  columns,
  pagination,
  sorting,
  columnFilters,
  baseCondition,
  defaultRequestSort
}: BuildDataTableDslRequestOptions<TData>): DataTableDslPageRequestBase {
  const resolvedColumns = resolveColumns(columns);

  return {
    pageNo: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    condition: buildCondition({ columnFilters, resolvedColumns, baseCondition }),
    sort: buildSort(sorting, resolvedColumns, defaultRequestSort)
  };
}
