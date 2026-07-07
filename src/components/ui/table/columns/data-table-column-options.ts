import type { ColumnDef } from '@tanstack/react-table';

import type {
  DataTableColumnDslQueryOptions,
  DataTableColumnFilterOptions,
  DataTableColumnFilterVariant,
  DataTableColumnPanelOptions,
  FilterVariant
} from '@/types/data-table';

type DataTableColumnMeta<TData, TValue> = NonNullable<ColumnDef<TData, TValue>['meta']>;
type DataTableColumnQueryMeta<TData, TValue> = DataTableColumnMeta<TData, TValue>['query'];

type DataTableColumnNativeOptions<TData, TValue> = Pick<
  ColumnDef<TData, TValue>,
  'size' | 'minSize' | 'maxSize' | 'enableSorting' | 'enableHiding' | 'enableResizing'
> & {
  enableColumnFilter?: boolean;
  meta?: ColumnDef<TData, TValue>['meta'];
};

export interface DataTableColumnResolvedDefaults {
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableSorting?: boolean;
  enableHiding?: boolean;
  enableResizing?: boolean;
  enableColumnFilter?: boolean;
  columnMenuVisible?: boolean;
  columnPanelVisible?: boolean;
  columnPanelReorder?: boolean;
}

export type DataTableColumnOptions<TData, TValue> = DataTableColumnNativeOptions<TData, TValue> &
  DataTableColumnFilterOptions &
  DataTableColumnDslQueryOptions<TData, TValue> &
  DataTableColumnPanelOptions;

interface ResolveDataTableColumnOptionsParams<TData, TValue> {
  title: string;
  defaults: DataTableColumnResolvedDefaults;
  options?: DataTableColumnOptions<TData, TValue>;
}

const FILTER_VARIANT_META = {
  text: 'text',
  select: 'select',
  multiSelect: 'multiSelect',
  date: 'date',
  dateRange: 'dateRange',
  number: 'number',
  numberRange: 'range',
  boolean: 'boolean'
} satisfies Record<DataTableColumnFilterVariant, FilterVariant>;

function inferFilterPlaceholder(variant: DataTableColumnFilterVariant, title: string) {
  switch (variant) {
    case 'text':
      return `搜索${title}`;
    case 'select':
    case 'multiSelect':
    case 'boolean':
    case 'date':
      return `选择${title}`;
    case 'dateRange':
      return `选择${title}范围`;
    case 'number':
      return `输入${title}`;
    case 'numberRange':
      return `输入${title}范围`;
  }
}

function resolveFilterMeta<TData, TValue>(
  title: string,
  options: DataTableColumnOptions<TData, TValue>
): ColumnDef<TData, TValue>['meta'] {
  const { filter, filterMin, filterMax } = options;

  if (!filter) {
    return {};
  }

  const range =
    typeof filterMin === 'number' && typeof filterMax === 'number'
      ? ([filterMin, filterMax] satisfies [number, number])
      : undefined;

  return {
    variant: FILTER_VARIANT_META[filter],
    placeholder: options.filterPlaceholder ?? inferFilterPlaceholder(filter, title),
    options: options.filterOptions ? [...options.filterOptions] : undefined,
    range,
    unit: options.filterUnit
  };
}

function hasQueryOptions<TData, TValue>(options: DataTableColumnOptions<TData, TValue>) {
  return Boolean(
    options.dsl?.filterField ||
    options.dsl?.sortField ||
    options.dsl?.filterOperator ||
    options.dsl?.serializeFilter ||
    options.meta?.query
  );
}

function resolveQueryMeta<TData, TValue>(
  options: DataTableColumnOptions<TData, TValue>
): DataTableColumnQueryMeta<TData, TValue> | undefined {
  if (!hasQueryOptions(options)) {
    return undefined;
  }

  return {
    ...options.meta?.query,
    operator: options.dsl?.filterOperator ?? options.meta?.query?.operator,
    filterField: options.dsl?.filterField ?? options.meta?.query?.filterField,
    sortField: options.dsl?.sortField ?? options.meta?.query?.sortField,
    serializeFilter: options.dsl?.serializeFilter ?? options.meta?.query?.serializeFilter
  };
}

function stripDslManagedMeta<TData, TValue>(
  meta: ColumnDef<TData, TValue>['meta']
): DataTableColumnMeta<TData, TValue> {
  if (!meta) {
    return {};
  }

  const nextMeta = { ...meta };
  delete nextMeta.variant;
  delete nextMeta.placeholder;
  delete nextMeta.options;
  delete nextMeta.range;
  delete nextMeta.unit;
  delete nextMeta.query;

  return nextMeta;
}

function resolveMeta<TData, TValue>(
  title: string,
  defaults: DataTableColumnResolvedDefaults,
  options: DataTableColumnOptions<TData, TValue>
): ColumnDef<TData, TValue>['meta'] {
  const filterDisabled = options.filter === false;
  const baseMeta = filterDisabled ? stripDslManagedMeta(options.meta) : (options.meta ?? {});
  const query = resolveQueryMeta(options);

  return {
    ...baseMeta,
    label:
      typeof baseMeta.label === 'string' && baseMeta.label.trim().length > 0
        ? baseMeta.label
        : title,
    ...resolveFilterMeta(title, options),
    query,
    columnMenuVisible: options.columnMenuVisible ?? defaults.columnMenuVisible,
    columnPanelVisible: options.columnPanelVisible ?? defaults.columnPanelVisible,
    columnPanelReorder: options.columnPanelReorder ?? defaults.columnPanelReorder
  };
}

export function resolveDataTableColumnOptions<TData, TValue>({
  title,
  defaults,
  options = {}
}: ResolveDataTableColumnOptionsParams<TData, TValue>): DataTableColumnNativeOptions<
  TData,
  TValue
> {
  return {
    size: options.size ?? defaults.size,
    minSize: options.minSize ?? defaults.minSize,
    maxSize: options.maxSize ?? defaults.maxSize,
    enableSorting: options.enableSorting ?? defaults.enableSorting,
    enableHiding: options.enableHiding ?? defaults.enableHiding,
    enableResizing: options.enableResizing ?? defaults.enableResizing,
    enableColumnFilter:
      options.filter === false
        ? false
        : (options.enableColumnFilter ?? (options.filter ? true : defaults.enableColumnFilter)),
    meta: resolveMeta(title, defaults, options)
  };
}
