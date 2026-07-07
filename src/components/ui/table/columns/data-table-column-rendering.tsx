import type { Column, ColumnDef } from '@tanstack/react-table';

import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';
import { DataTableColumnHeader } from '@/components/ui/table/columns/data-table-column-header';
import { nullableText } from '@/lib/display-formatters';
import type { DataTableColumnFilterOptions } from '@/types/data-table';

export type ColumnHeader<TData> = ColumnDef<TData>['header'];

export function dataTableHeader<TData>(
  column: Column<TData, unknown>,
  title: string,
  className?: string
) {
  return <DataTableColumnHeader column={column} title={title} className={className} />;
}

export function dataTableHeaderFactory<TData>(
  title: string,
  className?: string
): ColumnHeader<TData> {
  return ({ column }) => dataTableHeader(column, title, className);
}

export function renderDataTableTextCell(value: unknown, className?: string) {
  const text = nullableText(value);

  return (
    <DataTableOverflowTooltipText value={text} className={className}>
      {text}
    </DataTableOverflowTooltipText>
  );
}

export function dataTableTextCell(value: unknown, className?: string) {
  return renderDataTableTextCell(value, className);
}

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

export function resolveDataTableEnumLabel(value: unknown, options: DataTableColumnFilterOptions) {
  const normalizedValue = value == null ? undefined : String(value);
  if (!normalizedValue) {
    return undefined;
  }

  return options.filterOptions?.find((item) => item.value === normalizedValue)?.label;
}
