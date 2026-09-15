import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { InputGroupButton } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import {
  systemScheduleJobNextExecutionsMutationOptions,
  type SystemScheduleJobNextExecutionsRequest,
  type SystemScheduleJobNextExecutionsResponse
} from '@/lib/api/clients/service';
import type { ApiClientError } from '@oig/react-query-generator/core';

export interface ScheduleJobCronPreviewPopoverProps {
  cronExpression?: string;
  disabled?: boolean;
}

export function ScheduleJobCronPreviewPopover({
  cronExpression,
  disabled = false
}: ScheduleJobCronPreviewPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const { container, setTriggerNode, triggerRef } = useOverlayPortalContainer<HTMLButtonElement>();

  const trimmedCron = cronExpression?.trim() ?? '';

  const nextExecutionsMutation = useMutation<
    SystemScheduleJobNextExecutionsResponse,
    ApiClientError,
    SystemScheduleJobNextExecutionsRequest
  >(systemScheduleJobNextExecutionsMutationOptions());

  const handleFetch = React.useCallback(() => {
    if (!trimmedCron) return;
    nextExecutionsMutation.mutate({ cronExpression: trimmedCron, count: 5 });
  }, [trimmedCron, nextExecutionsMutation]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && trimmedCron) {
        handleFetch();
      }
    },
    [handleFetch, trimmedCron]
  );

  const { data, isPending, error, isError, isSuccess } = nextExecutionsMutation;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <InputGroupButton
          type='button'
          variant='ghost'
          size='xs'
          ref={setTriggerNode}
          className='text-muted-foreground hover:text-foreground gap-1 px-2'
          title='查看接下来 5 次执行时间'
          aria-label='查看接下来 5 次执行时间'
          disabled={disabled}
        >
          <Icons.clock className='size-3.5' />
          <span className='text-xs font-normal'>预演</span>
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        container={container}
        finalFocus={triggerRef}
        sideOffset={6}
        className='w-84 p-4'
      >
        <div className='flex items-center justify-between pb-2 border-b mb-3'>
          <div className='flex items-center gap-1.5 font-medium text-sm'>
            <Icons.calendar className='size-4 text-primary' />
            <span>接下来 5 次执行时间</span>
          </div>
          {trimmedCron && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-6 w-6 p-0 text-muted-foreground hover:text-foreground'
              title='重新计算'
              aria-label='重新计算'
              disabled={isPending}
              onClick={handleFetch}
            >
              <Icons.rotate className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>

        <div className='text-xs text-muted-foreground mb-3 break-all'>
          当前表达式：
          <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-foreground font-semibold'>
            {trimmedCron || '未填写'}
          </code>
        </div>

        {!trimmedCron ? (
          <div className='rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground'>
            请先输入有效的 Cron 表达式
          </div>
        ) : isPending ? (
          <div className='flex flex-col items-center justify-center gap-2 py-4 text-xs text-muted-foreground'>
            <Spinner className='size-4 text-primary' />
            <span>正在预演接下来 5 次执行时间...</span>
          </div>
        ) : isError ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2'>
            <Icons.alertCircle className='size-4 shrink-0 mt-0.5' />
            <span>
              {
                normalizeApiError(error, {
                  fallbackMessage: '表达式格式错误，无法计算执行时间'
                }).message
              }
            </span>
          </div>
        ) : isSuccess && data ? (
          data.length > 0 ? (
            <div className='space-y-1.5'>
              {data.map((time, index) => (
                <div
                  key={`${time}-${index}`}
                  className='flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-xs'
                >
                  <span className='text-muted-foreground flex items-center gap-1.5'>
                    <span className='flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-medium'>
                      {index + 1}
                    </span>
                    <span>第 {index + 1} 次</span>
                  </span>
                  <span className='font-mono font-medium'>{time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className='rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground'>
              暂无后续执行时间
            </div>
          )
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
