import type { Row } from '@tanstack/react-table';
import { useId, type ReactNode } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** 树列只装饰原有内容；展开按钮不接管单元格的选择、复制和 Tooltip。 */
export function DataTableTreeCell<TData>({
  row,
  label,
  children
}: {
  row: Row<TData>;
  label: string;
  children: ReactNode;
}) {
  const descriptionId = useId();
  const canExpand = row.getCanExpand();
  const expanded = row.getIsExpanded();

  return (
    <div
      data-slot='data-table-tree-cell'
      data-tree-depth={row.depth}
      className='flex min-w-0 w-full items-center gap-1.5'
      style={{ paddingInlineStart: row.depth * 20 }}
    >
      <span id={descriptionId} className='sr-only'>
        第 {row.depth + 1} 层，{canExpand ? '有下级' : '末级'}
      </span>
      {canExpand ? (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-7 shrink-0'
          data-tree-toggle={row.id}
          data-row-expand-ignore
          aria-label={`${expanded ? '收起' : '展开'} ${label}`}
          aria-expanded={expanded}
          aria-describedby={descriptionId}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            row.toggleExpanded();
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              event.stopPropagation();
              row.toggleExpanded(event.key === 'ArrowRight');
            } else if (event.key === 'Enter' || event.key === ' ') {
              // 原生按钮负责触发 click，避免与单元格/行键盘操作重复执行。
              event.stopPropagation();
            }
          }}
        >
          <Icons.chevronRight
            aria-hidden='true'
            className={cn('size-4 transition-transform', expanded && 'rotate-90')}
          />
        </Button>
      ) : (
        <span aria-hidden='true' data-slot='data-table-tree-spacer' className='size-7 shrink-0' />
      )}
      <div data-tree-cell-content className='min-w-0 flex-1'>
        {children}
      </div>
    </div>
  );
}
