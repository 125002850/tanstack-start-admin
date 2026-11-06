import { useQuery } from '@tanstack/react-query';
import { RefreshButton } from '@/components/refresh-button';
import { Button } from '@/components/ui/button';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { SILENT_QUERY_META } from '@/lib/query-client';
import { scheduleExecutionLogsQueryOptions } from '../api/queries';
import {
  executionDuration,
  executionPollInterval,
  executionStatusLabel,
  executionStatusVariant
} from '../lib/execution';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icons } from '@/components/icons';
import { nullableDateTime, nullableText } from '@/lib/formatters/display';
import {
  type ScheduleJobRspDTO,
  type ScheduleJobExecutionLogRspDTO
} from '@/lib/api/clients/service';

interface ScheduleJobExecutionLogSheetProps {
  job: ScheduleJobRspDTO;
  open: boolean;
  triggeredAt?: number;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleJobExecutionLogSheet({
  job,
  open,
  triggeredAt = 0,
  onOpenChange
}: ScheduleJobExecutionLogSheetProps) {
  const {
    data: logs = [],
    isPending,
    isError,
    error,
    refetch
  } = useQuery({
    ...scheduleExecutionLogsQueryOptions(job.id),
    enabled: open && job.id != null,
    refetchInterval: (query) => executionPollInterval(query.state.data, triggeredAt),
    refetchIntervalInBackground: false,
    meta: SILENT_QUERY_META
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full max-w-xl flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>执行记录</SheetTitle>
          <SheetDescription>
            {nullableText(job.jobName)}（{nullableText(job.jobCode)}）
          </SheetDescription>
        </SheetHeader>
        <div className='flex justify-end'>
          <RefreshButton label='刷新执行记录' onRefresh={refetch} />
        </div>
        {isError ? (
          <div role='alert' className='flex items-center gap-2 text-sm text-destructive'>
            <span>{normalizeApiError(error, { fallbackMessage: '执行记录加载失败' }).message}</span>
            <Button variant='outline' size='sm' onClick={() => void refetch()}>
              重试
            </Button>
          </div>
        ) : null}
        {logs.some((log) => log.status === 'running') ? (
          <p className='text-xs text-muted-foreground'>
            执行中表示尚未收到结束结果；若长时间未结束，请核查任务及服务运行情况。
          </p>
        ) : null}
        <ScrollArea className='min-h-0 flex-1'>
          {isPending && logs.length === 0 ? (
            <div className='flex items-center justify-center py-16'>
              <Icons.spinner className='mr-2 size-5 animate-spin text-muted-foreground' />
              <span className='text-sm text-muted-foreground'>加载中...</span>
            </div>
          ) : logs.length === 0 && !isError ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Icons.chartInfographic className='mb-2 size-10 text-muted-foreground/50' />
              <p className='text-sm text-muted-foreground'>暂无执行记录</p>
            </div>
          ) : (
            <div className='relative py-2 pl-6'>
              <div className='absolute bottom-0 left-[11px] top-2 w-px bg-border' />
              <div className='flex flex-col gap-6'>
                {logs.map((log) => (
                  <ExecutionLogItem key={log.id} log={log} />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ExecutionLogItem({ log }: { log: ScheduleJobExecutionLogRspDTO }) {
  return (
    <div className='relative'>
      <div className='absolute -left-[25px] top-1.5 size-[9px] rounded-full border-2 border-border bg-background' />
      <div className='rounded-lg border px-3 py-2.5'>
        <div className='flex items-center gap-2'>
          <Badge
            variant={executionStatusVariant(log.status)}
            className='h-5 shrink-0 px-1.5 text-[10px]'
          >
            {log.status === 'running' ? <Icons.spinner className='animate-spin' /> : null}
            {executionStatusLabel(log.status)}
          </Badge>
          <span className='text-xs text-muted-foreground'>{nullableDateTime(log.startTime)}</span>
        </div>
        <div className='mt-1.5 grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs'>
          <span className='text-muted-foreground'>开始时间</span>
          <span>{nullableDateTime(log.startTime)}</span>
          <span className='text-muted-foreground'>结束时间</span>
          <span>{nullableDateTime(log.endTime)}</span>
          <span className='text-muted-foreground'>执行时长</span>
          <span>{executionDuration(log)}</span>
        </div>
        {log.status === 'failed' && log.errorMessage ? (
          <div className='mt-2 rounded bg-destructive/10 px-3 py-2'>
            <p className='text-xs font-medium text-destructive'>错误信息</p>
            <p className='mt-0.5 break-all text-xs text-destructive/80'>{log.errorMessage}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
