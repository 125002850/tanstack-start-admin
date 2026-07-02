import { endOfDay, format, startOfDay } from 'date-fns';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState
} from '@tanstack/react-table';

import type { DataTableDslOperator, FilterVariant } from '@/types/data-table';

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

type SupportedFilterVariant =
  | keyof typeof TEXT_VARIANT_OPERATORS
  | keyof typeof DATE_VARIANT_OPERATORS;

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

function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value];

  return values
    .map((item) => normalizeStringValue(item))
    .filter((item): item is string => Boolean(item));
}

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
  if (!variant) {
    return undefined;
  }

  const field = resolvedColumn.id;

  if (variant === 'text' || variant === 'select') {
    const value =
      variant === 'select'
        ? normalizeStringArray(filter.value)[0]
        : normalizeStringValue(filter.value);
    if (!value) {
      return undefined;
    }

    const op = resolveOperator(variant, meta.query?.operator, field);
    return { nodeType: 'text', field, op: op as DataTableDslTextCondition['op'], value };
  }

  if (variant === 'multiSelect') {
    const values = normalizeStringArray(filter.value);
    if (values.length === 0) {
      return undefined;
    }

    const op = resolveOperator(variant, meta.query?.operator, field);
    return { nodeType: 'text', field, op: op as DataTableDslTextCondition['op'], values };
  }

  if (variant === 'date') {
    const date = parseTimestamp(filter.value);
    if (!date) {
      return undefined;
    }

    return {
      nodeType: 'dateTime',
      field,
      op: 'BETWEEN',
      start: toStartOfDay(date),
      end: toEndOfDay(date)
    };
  }

  if (variant === 'dateRange') {
    const [fromRaw, toRaw] = Array.isArray(filter.value) ? filter.value : [filter.value, undefined];
    const from = parseTimestamp(fromRaw);
    const to = parseTimestamp(toRaw);

    if (!from && !to) {
      return undefined;
    }

    if (from && to) {
      return {
        nodeType: 'dateTime',
        field,
        op: 'BETWEEN',
        start: toStartOfDay(from),
        end: toEndOfDay(to)
      };
    }

    if (from) {
      return {
        nodeType: 'dateTime',
        field,
        op: 'GTE',
        value: toStartOfDay(from)
      };
    }

    return {
      nodeType: 'dateTime',
      field,
      op: 'LTE',
      value: toEndOfDay(to!)
    };
  }

  return undefined;
}

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

      return {
        field: resolvedColumn.id,
        direction: sort.desc ? 'DESC' : 'ASC'
      } satisfies DataTableDslSortItem;
    })
    .filter((item): item is DataTableDslSortItem => Boolean(item));

  if (items.length > 0) return items;
  return defaultRequestSort && defaultRequestSort.length > 0 ? defaultRequestSort : undefined;
}

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
    return baseCondition;
  }

  return {
    nodeType: 'compose',
    logic: 'AND',
    children: baseCondition ? [baseCondition, ...filterConditions] : filterConditions
  };
}

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
