import type { Column, ColumnDef, Table } from '@tanstack/react-table';

import { DataTableOverflowTooltipText } from '@/components/data-table/cells/data-table-overflow-tooltip-text';
import { DataTableColumnHeader } from '@/components/data-table/columns/data-table-column-header';
import { nullableText } from '@/lib/display-formatters';
import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableColumnFilterOptions
} from '@/types/data-table';

/**
 * DataTable 列渲染工具。
 *
 * 这些 helper 是 createDataTableColumnDsl 和业务自定义列之间的共享层：统一表头菜单、
 * 文本单元格截断、对齐 class 和 enum label 解析。
 */
export type ColumnHeader<TData> = ColumnDef<TData>['header'];

/** 渲染带排序/隐藏菜单的标准列头。 */
export function dataTableHeader<TData>(
  column: Column<TData, unknown>,
  title: string,
  className?: string,
  table?: Table<TData>
) {
  return (
    <DataTableColumnHeader column={column} table={table} title={title} className={className} />
  );
}

/** 返回 TanStack ColumnDef.header 可直接使用的工厂函数。 */
export function dataTableHeaderFactory<TData>(
  title: string,
  className?: string
): ColumnHeader<TData> {
  return ({ column, table }) => dataTableHeader(column, title, className, table);
}

/** 渲染普通文本 cell，统一空值占位、截断和 Tooltip。 */
export function renderDataTableTextCell(value: unknown, className?: string) {
  const text = nullableText(value);

  return (
    <DataTableOverflowTooltipText value={text} className={className}>
      {text}
    </DataTableOverflowTooltipText>
  );
}

/** 兼容旧命名的文本 cell helper。 */
export function dataTableTextCell(value: unknown, className?: string) {
  return renderDataTableTextCell(value, className);
}

/** 类型默认值的 align 字段最终转换为 Tailwind 文本对齐 class。 */
export function getDataTableAlignClassName(align: 'left' | 'center' | 'right' | undefined) {
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
export function resolveDataTableEnumLabel(value: unknown, options: DataTableColumnFilterOptions) {
  const normalizedValue = value == null ? undefined : String(value);
  if (!normalizedValue) {
    return undefined;
  }

  return options.filterOptions?.find((item) => item.value === normalizedValue)?.label;
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
