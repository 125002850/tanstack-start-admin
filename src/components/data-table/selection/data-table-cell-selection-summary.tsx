import { useMemo, type ReactNode, type Ref } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyTextToClipboard } from '@/lib/browser/copy-text-to-clipboard';
import { getCoordinateKey } from './model';
import { formatDataTableSelectionNumber, summarizeDataTableCellRange } from './summary';
import type {
  DataTableCellSelectionModel,
  DataTableCellSelectionSummary as SelectionSummary
} from './types';

/** Portal 的宿主与回退文案共享位置；选区仍由表体管理，无需同步第二份统计状态。 */
export function DataTableCellSelectionSummarySlot({
  ref,
  children
}: {
  ref: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  return (
    <div className='group/cell-summary flex min-h-12 w-full min-w-min flex-1 items-center sm:w-auto'>
      <div ref={ref} className='w-full min-w-0 empty:hidden' />
      <div className='text-muted-foreground text-sm whitespace-nowrap group-has-[[data-slot=data-table-cell-selection-summary]]/cell-summary:hidden'>
        {children}
      </div>
    </div>
  );
}

export function DataTableCellSelectionSummary<TData>({
  model
}: {
  model: DataTableCellSelectionModel<TData>;
}) {
  const { rangeBounds, rangeIndex, cellsByCoordinate } = model;
  const summary = useMemo(
    () =>
      rangeBounds
        ? summarizeDataTableCellRange(rangeBounds, rangeIndex, (coordinate) =>
            cellsByCoordinate.get(getCoordinateKey(coordinate))?.getValue()
          )
        : null,
    [rangeBounds, rangeIndex, cellsByCoordinate]
  );

  if (!summary || summary.selectedCount < 2) return null;

  const numericItems = summary.numericCount > 0;
  const items: Array<{
    label: string;
    value: SelectionSummary['sum'] | number;
    format?: 'average';
  }> = [
    ...(numericItems ? [{ label: '合计', value: summary.sum }] : []),
    { label: '选中', value: summary.selectedCount },
    ...(numericItems
      ? [
          { label: '平均', value: summary.average, format: 'average' as const },
          { label: '最小值', value: summary.min },
          { label: '最大值', value: summary.max }
        ]
      : [])
  ];

  return (
    <div
      role='group'
      aria-label='选区汇总'
      data-slot='data-table-cell-selection-summary'
      className='flex w-full flex-wrap items-center gap-x-3 gap-y-1'
    >
      {items.map(({ label, value, format }) => {
        const { text, copyText } = formatDataTableSelectionNumber(value, format);
        const description =
          label === '选中'
            ? `${summary.selectedCount} 个单元格，其中 ${summary.numericCount} 个为数值`
            : `按 ${summary.numericCount} 个数值单元格计算`;
        return (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-5 gap-1 px-0 tabular-nums whitespace-nowrap'
                aria-label={`${label}：${text}`}
                aria-disabled={copyText === null || undefined}
                onClick={async (event) => {
                  if (copyText === null) return;
                  const copied = await copyTextToClipboard(copyText, {
                    container: event.currentTarget.parentElement
                  });
                  if (copied) toast.success('已复制', { id: 'data-table-selection-summary-copy' });
                  else toast.error('复制失败，请重试', { id: 'data-table-selection-summary-copy' });
                }}
              >
                <span className='text-muted-foreground'>{label}</span>
                <span>{text}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {description}
              {copyText === null ? '，合计超出数值范围' : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
