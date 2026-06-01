import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

interface DataTableExpandTriggerProps {
  expanded: boolean;
  panelId: string;
  onPressed: () => void;
}

export function DataTableExpandTrigger({
  expanded,
  panelId,
  onPressed
}: DataTableExpandTriggerProps) {
  const label = expanded ? '收起详情' : '展开详情';

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className='h-8 w-8'
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={panelId}
      data-slot='data-table-expand-trigger'
      data-row-expand-ignore
      onClick={(event) => {
        event.stopPropagation();
        onPressed();
      }}
    >
      <Icons.chevronDown
        className={cn('size-4 transition-transform', expanded && 'rotate-180')}
        aria-hidden='true'
      />
    </Button>
  );
}
