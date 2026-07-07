import * as React from 'react';

import { Button } from '@/components/ui/button';
import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';
import { cn } from '@/lib/utils';

/**
 * 表格内“看起来像链接的按钮”单元格。
 *
 * 适用于点击后打开详情、弹窗或触发命令的场景；默认 stopPropagation，避免点击按钮同时触发
 * 行展开/行选择。文本值会复用 DataTable 的溢出 Tooltip。
 */
interface DataTableLinkButtonCellProps {
  value?: React.ReactNode;
  className?: string;
  stopPropagation?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function isEmptyValue(value: React.ReactNode) {
  return value == null || value === '';
}

/** 只有 primitive 文本才参与 Tooltip；复杂 ReactNode 由调用方自行负责可访问文本。 */
function textValue(value: React.ReactNode): string | null {
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'bigint') return String(value);
  return null;
}

export function DataTableLinkButtonCell({
  value,
  className,
  stopPropagation = true,
  onClick
}: DataTableLinkButtonCellProps) {
  if (isEmptyValue(value)) return '-';

  const tooltipText = textValue(value);

  return (
    <Button
      type='button'
      variant='link'
      className={cn(
        'h-auto max-w-full min-w-0 shrink justify-start overflow-hidden p-0 text-left font-medium',
        className
      )}
      onClick={(event) => {
        if (stopPropagation) {
          // 表格行通常也有点击展开或选择逻辑，按钮点击默认不冒泡。
          event.stopPropagation();
        }
        onClick(event);
      }}
    >
      {tooltipText ? (
        <DataTableOverflowTooltipText value={tooltipText} className='min-w-0 flex-1'>
          {tooltipText}
        </DataTableOverflowTooltipText>
      ) : (
        value
      )}
    </Button>
  );
}
