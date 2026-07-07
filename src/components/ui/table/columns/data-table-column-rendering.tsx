import type { Column, ColumnDef } from '@tanstack/react-table';

import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';
import { DataTableColumnHeader } from '@/components/ui/table/columns/data-table-column-header';
import { nullableText } from '@/lib/display-formatters';
import type { DataTableColumnFilterOptions } from '@/types/data-table';

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
  className?: string
) {
  return <DataTableColumnHeader column={column} title={title} className={className} />;
}

/** 返回 TanStack ColumnDef.header 可直接使用的工厂函数。 */
export function dataTableHeaderFactory<TData>(
  title: string,
  className?: string
): ColumnHeader<TData> {
  return ({ column }) => dataTableHeader(column, title, className);
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
