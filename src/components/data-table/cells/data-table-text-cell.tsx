import { DataTableOverflowTooltipText } from '@/components/data-table/cells/data-table-overflow-tooltip-text';
import { nullableText } from '@/lib/formatters/display';

/** 渲染普通文本 cell，统一空值占位、截断和 Tooltip。 */
export function renderDataTableTextCell(value: unknown, className?: string) {
  const text = nullableText(value);

  return (
    <DataTableOverflowTooltipText value={text} className={className}>
      {text}
    </DataTableOverflowTooltipText>
  );
}

/** 面向业务自定义列的文本 cell helper。 */
export function dataTableTextCell(value: unknown, className?: string) {
  return renderDataTableTextCell(value, className);
}
