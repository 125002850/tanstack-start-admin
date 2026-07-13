import type { ColumnDef } from '@tanstack/react-table';

import { resolveDataTableColumnSize, type DataTableColumnSize } from '@/config/data-table';
import type {
  DataTableColumnDslQueryOptions,
  DataTableColumnFilterOptions,
  DataTableColumnFilterVariant,
  DataTableColumnPanelOptions,
  FilterVariant
} from '@/types/data-table';

/**
 * DataTable ColumnDef 选项合并器。
 *
 * 负责把 DSL 层的筛选配置、后端查询 meta、列面板行为和 TanStack 原生列配置合并成
 * ColumnDef 可识别的字段，避免业务侧直接操作 columnDef.meta 的内部结构。
 */
type DataTableColumnMeta<TData, TValue> = NonNullable<ColumnDef<TData, TValue>['meta']>;
type DataTableColumnQueryMeta<TData, TValue> = DataTableColumnMeta<TData, TValue>['query'];

type DataTableColumnNativeOptions<TData, TValue> = Pick<
  ColumnDef<TData, TValue>,
  'size' | 'minSize' | 'maxSize' | 'enableSorting' | 'enableHiding' | 'enableResizing'
> & {
  enableColumnFilter?: boolean;
  meta?: ColumnDef<TData, TValue>['meta'];
};

type DataTableColumnInputOptions<TData, TValue> = Omit<
  DataTableColumnNativeOptions<TData, TValue>,
  'size'
> & {
  size?: DataTableColumnSize;
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

export type DataTableColumnOptions<TData, TValue> = DataTableColumnInputOptions<TData, TValue> &
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

/** 未显式传 placeholder 时，根据筛选类型和列名生成后台场景可读的占位文案。 */
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

/** 将 DSL 的 filter 配置转换为 DataTableToolbar 能识别的 column.meta 字段。 */
function resolveFilterMeta<TData, TValue>(
  title: string,
  options: DataTableColumnOptions<TData, TValue>
): ColumnDef<TData, TValue>['meta'] {
  const { filter, filterMin, filterMax } = options;

  if (!filter) {
    return {};
  }

  const range =
    // 目前数值范围筛选只接受 number，Date 范围留给 date/dateRange 自己处理。
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

/** 判断是否声明了任何后端 DSL 查询相关配置。 */
function hasQueryOptions<TData, TValue>(options: DataTableColumnOptions<TData, TValue>) {
  return Boolean(
    options.dsl?.filterField ||
    options.dsl?.sortField ||
    options.dsl?.filterOperator ||
    options.dsl?.serializeFilter ||
    options.meta?.query
  );
}

/** 将 dsl 字段标准化到 meta.query，useDslDataTable 会从这里读取序列化规则。 */
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

/** filter=false 时移除由 DSL 管理的 meta 字段，避免调用方残留旧筛选配置。 */
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

/** 合并最终 meta：label、筛选 UI、后端查询和列面板配置都在这里落位。 */
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
      // meta.label 显式传入时优先，否则使用 DSL title 作为列面板/拖拽显示名。
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

/** 解析 ColumnDef 原生配置和 meta，供 field/badge/actions/custom DSL 共用。 */
export function resolveDataTableColumnOptions<TData, TValue>({
  title,
  defaults,
  options = {}
}: ResolveDataTableColumnOptionsParams<TData, TValue>): DataTableColumnNativeOptions<
  TData,
  TValue
> {
  return {
    size: resolveDataTableColumnSize(options.size ?? defaults.size),
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
