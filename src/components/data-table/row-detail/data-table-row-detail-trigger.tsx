import type { Row } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

export function rowDetailId(instanceId: string, rowId: string) {
  return `${instanceId}-detail-${encodeURIComponent(rowId)}`;
}

export function DataTableRowDetailTrigger<TData>({
  row,
  label,
  instanceId,
  children
}: {
  row: Row<TData>;
  label: string;
  instanceId: string;
  children: ReactNode;
}) {
  const expanded = row.getIsExpanded();
  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      {row.getCanExpand() ? (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-7 shrink-0'
          data-row-expand-ignore
          aria-label={`${expanded ? '收起' : '展开'} ${label}`}
          aria-expanded={expanded}
          aria-controls={expanded ? rowDetailId(instanceId, row.id) : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            row.toggleExpanded();
          }}
        >
          <Icons.chevronRight
            aria-hidden
            className={cn('size-4 transition-transform', expanded && 'rotate-90')}
          />
        </Button>
      ) : (
        <span aria-hidden className='size-7 shrink-0' />
      )}
      <div data-row-detail-cell-content className='min-w-0 flex-1'>
        {children}
      </div>
    </div>
  );
}
