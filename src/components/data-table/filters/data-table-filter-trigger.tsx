import * as React from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface DataTableFilterLabelItem {
  key: React.Key;
  label: React.ReactNode;
}

type DataTableFilterTriggerState =
  | {
      status: 'idle';
      icon?: React.ReactNode;
    }
  | {
      status: 'active';
      onClear: React.MouseEventHandler<HTMLElement>;
      selection:
        | {
            kind: 'labels';
            items: readonly DataTableFilterLabelItem[];
            count: number;
            summaryText?: string;
          }
        | {
            kind: 'value';
            content: React.ReactNode;
          };
    };

interface DataTableFilterTriggerProps extends Omit<
  React.ComponentProps<typeof Button>,
  'children' | 'className' | 'size' | 'title' | 'variant'
> {
  title?: React.ReactNode;
  state?: DataTableFilterTriggerState;
}

/**
 * DataTable Toolbar 筛选器的唯一外层触发器。
 *
 * 尺寸、边框、图标、激活态、清除入口和选择摘要都由这里管理，业务筛选器只负责内容。
 */
export function DataTableFilterTrigger({
  title,
  state = { status: 'idle' },
  ...props
}: DataTableFilterTriggerProps) {
  const isActive = state.status === 'active';

  return (
    <Button
      {...props}
      variant='outline'
      size='sm'
      className='data-table-filter-control border-dashed'
      data-slot='data-table-filter-trigger'
      data-active={isActive ? 'true' : undefined}
    >
      {isActive ? (
        <span
          aria-hidden='true'
          data-filter-clear=''
          className='rounded-sm opacity-70 transition-opacity hover:opacity-100'
          onClick={state.onClear}
        >
          <Icons.xCircle />
        </span>
      ) : (
        (state.icon ?? <Icons.plusCircle />)
      )}
      {title}
      {isActive ? (
        <>
          <Separator orientation='vertical' className='mx-0.5 data-[orientation=vertical]:h-4' />
          {state.selection.kind === 'labels' ? (
            <>
              <Badge variant='secondary' className='rounded-sm px-1 font-normal lg:hidden'>
                {state.selection.count}
              </Badge>
              <div className='hidden items-center gap-1 lg:flex'>
                {state.selection.count > 2 ? (
                  <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
                    {state.selection.summaryText ?? `已选 ${state.selection.count} 项`}
                  </Badge>
                ) : (
                  state.selection.items.map((item) => (
                    <Badge
                      variant='secondary'
                      key={item.key}
                      className='rounded-sm px-1 font-normal'
                    >
                      {item.label}
                    </Badge>
                  ))
                )}
              </div>
            </>
          ) : (
            state.selection.content
          )}
        </>
      ) : null}
    </Button>
  );
}

export type { DataTableFilterTriggerProps, DataTableFilterTriggerState };
