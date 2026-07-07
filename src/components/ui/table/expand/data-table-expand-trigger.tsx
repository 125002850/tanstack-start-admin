import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * 行展开相关的轻量交互控件。
 *
 * DataTable 当前主要通过整行点击展开；Trigger 和 ResizeHandle 保留给需要显式按钮或
 * 主表/详情面板分屏调整的场景。
 */
interface DataTableExpandTriggerProps {
  expanded: boolean;
  panelId: string;
  onPressed: () => void;
}

interface DataTableExpandResizeHandleProps {
  min: number;
  max: number;
  value: number;
  disabled: boolean;
  dragging: boolean;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
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
        // 展开按钮本身不能冒泡到行点击，否则会触发两次展开逻辑。
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

export function DataTableExpandResizeHandle({
  min,
  max,
  value,
  disabled,
  dragging,
  onKeyDown,
  onPointerDown
}: DataTableExpandResizeHandleProps) {
  return (
    // role=separator + aria-valuenow 让屏幕阅读器理解这是可调整的水平分隔条。
    <div
      role='separator'
      tabIndex={0}
      aria-label='调整主表高度'
      aria-orientation='horizontal'
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled ? true : undefined}
      data-slot='data-table-expand-split-handle'
      className='group relative flex h-2 shrink-0 touch-none cursor-row-resize select-none items-center justify-center outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]'
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    >
      <span
        className={cn(
          'inline-flex h-1.5 w-10 items-center justify-center rounded-full transition-all duration-200',
          dragging
            ? 'bg-muted-foreground/45'
            : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/40 group-focus-visible:bg-muted-foreground/40'
        )}
      >
        <span className='inline-flex gap-px'>
          <span className='bg-background/80 block size-0.5 rounded-full' />
          <span className='bg-background/80 block size-0.5 rounded-full' />
          <span className='bg-background/80 block size-0.5 rounded-full' />
        </span>
      </span>
    </div>
  );
}
