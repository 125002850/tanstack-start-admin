import type { Column, ColumnDef, Table } from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/data-table/columns/header/data-table-column-header';
import { isDataTableFlatFilterOptions } from '@/types/data-table';
import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableColumnAlign,
  DataTableColumnFilterOptions
} from '@/types/data-table';

export {
  dataTableTextCell,
  renderDataTableTextCell
} from '@/components/data-table/cells/data-table-text-cell';

/**
 * DataTable 列渲染工具。
 *
 * 这些 helper 是 createDataTableColumnDsl 和业务自定义列之间的共享层：统一表头排序、
 * 文本单元格截断、对齐 class 和 enum label 解析。
 */
export type ColumnHeader<TData> = ColumnDef<TData>['header'];

/** 渲染带直接排序和本地筛选入口的标准列头。 */
export function dataTableHeader<TData>(
  column: Column<TData, unknown>,
  title: string,
  className?: string,
  table?: Table<TData>,
  align: DataTableColumnAlign = 'center'
) {
  return (
    <DataTableColumnHeader
      column={column}
      table={table}
      title={title}
      align={align}
      className={className}
    />
  );
}

/** 返回 TanStack ColumnDef.header 可直接使用的工厂函数。 */
export function dataTableHeaderFactory<TData>(
  title: string,
  className?: string,
  align: DataTableColumnAlign = 'center'
): ColumnHeader<TData> {
  return ({ column, table }) => dataTableHeader(column, title, className, table, align);
}

/** 类型默认值的 align 字段最终转换为 Tailwind 文本对齐 class。 */
export function getDataTableAlignClassName(align: DataTableColumnAlign | undefined) {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'left':
    default:
      return undefined;
  }
}

/** enum 类型字段优先从 filterOptions 找 label，避免展示值和筛选项文案不一致。 */
export function resolveDataTableEnumLabel(
  value: unknown,
  options: Pick<DataTableColumnFilterOptions, 'filterOptions'>
) {
  const normalizedValue = value == null ? undefined : String(value);
  if (!normalizedValue) {
    return undefined;
  }

  const filterOptions = options.filterOptions;
  const flatOptions = isDataTableFlatFilterOptions(filterOptions)
    ? filterOptions
    : filterOptions?.kind === 'tree'
      ? filterOptions.options
      : undefined;
  return flatOptions?.find((item) => item.value === normalizedValue)?.label;
}

/** 将选择列的标量/数组值映射为 label；未知值保留原值，多选保持原顺序。 */
export function resolveDataTableChoiceLabel(
  value: unknown,
  options: readonly DataTableChoiceOption<DataTableChoiceValue>[]
) {
  const optionByValue = new Map(options.map((option) => [option.value, option.label]));
  const resolveValue = (item: unknown) => {
    if (typeof item !== 'string' && typeof item !== 'number') return String(item ?? '');
    return optionByValue.get(item) ?? String(item);
  };

  return Array.isArray(value) ? value.map(resolveValue).join('、') : resolveValue(value);
}
