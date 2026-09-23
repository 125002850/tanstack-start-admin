import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ApiClientError } from '@oig/react-query-generator/core';

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
  systemScheduleJobExecutionLogs,
  type SystemScheduleJobExecutionLogsRequest,
  type SystemScheduleJobExecutionLogsResponse,
  type ScheduleJobExecutionLogRspDTO
} from '@/lib/api/clients/service';

const SCHEDULE_JOB_EXECUTION_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed'
} as const;

const EXEC_STATUS_LABELS: Record<string, string> = {
  [SCHEDULE_JOB_EXECUTION_STATUS.SUCCESS]: '成功',
  [SCHEDULE_JOB_EXECUTION_STATUS.FAILED]: '失败'
};

function getExecStatusLabel(status?: string): string {
  if (!status) return '-';
  return EXEC_STATUS_LABELS[status] ?? status;
}

function getExecStatusBadgeVariant(status?: string): React.ComponentProps<typeof Badge>['variant'] {
  if (status === SCHEDULE_JOB_EXECUTION_STATUS.SUCCESS) return 'success';
  if (status === SCHEDULE_JOB_EXECUTION_STATUS.FAILED) return 'destructive';
  return 'outline';
}

interface ScheduleJobExecutionLogSheetProps {
  job: ScheduleJobRspDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleJobExecutionLogSheet({
  job,
  open,
  onOpenChange
}: ScheduleJobExecutionLogSheetProps) {
  const [logs, setLogs] = React.useState<ScheduleJobExecutionLogRspDTO[]>([]);
  const [hasFetched, setHasFetched] = React.useState(false);

  const { mutate: fetchLogs, isPending } = useMutation<
    SystemScheduleJobExecutionLogsResponse,
    ApiClientError,
    SystemScheduleJobExecutionLogsRequest
  >({
    mutationFn: (request) => systemScheduleJobExecutionLogs(request)
  });

  React.useEffect(() => {
    if (open && job.id != null && !hasFetched) {
      setHasFetched(true);
      fetchLogs(
        { jobId: job.id },
        {
          onSuccess: (data) => setLogs(data ?? [])
        }
      );
    }
  }, [fetchLogs, hasFetched, job.id, open]);

  React.useEffect(() => {
    if (!open) {
      setLogs([]);
      setHasFetched(false);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full max-w-xl flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>执行记录</SheetTitle>
          <SheetDescription>
            {nullableText(job.jobName)}（{nullableText(job.jobCode)}）
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className='min-h-0 flex-1'>
          {isPending && logs.length === 0 ? (
            <div className='flex items-center justify-center py-16'>
              <Icons.spinner className='mr-2 size-5 animate-spin text-muted-foreground' />
              <span className='text-sm text-muted-foreground'>加载中...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Icons.chartInfographic className='mb-2 size-10 text-muted-foreground/50' />
              <p className='text-sm text-muted-foreground'>暂无执行记录</p>
            </div>
          ) : (
            <div className='relative py-2 pl-6'>
              <div className='absolute bottom-0 left-[11px] top-2 w-px bg-border' />
              <div className='space-y-6'>
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
      <div
        className={`absolute -left-[25px] top-1.5 size-[9px] rounded-full border-2 ${
          log.status === SCHEDULE_JOB_EXECUTION_STATUS.FAILED
            ? 'border-destructive bg-destructive/20'
            : 'border-emerald-500 bg-emerald-500/20'
        }`}
      />
      <div className='rounded-lg border px-3 py-2.5'>
        <div className='flex items-center gap-2'>
          <Badge
            variant={getExecStatusBadgeVariant(log.status)}
            className='h-5 shrink-0 px-1.5 text-[10px]'
          >
            {getExecStatusLabel(log.status)}
          </Badge>
          <span className='text-xs text-muted-foreground'>{nullableDateTime(log.startTime)}</span>
        </div>
        <div className='mt-1.5 grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs'>
          <span className='text-muted-foreground'>开始时间</span>
          <span>{nullableDateTime(log.startTime)}</span>
          <span className='text-muted-foreground'>结束时间</span>
          <span>{nullableDateTime(log.endTime)}</span>
        </div>
        {log.status === SCHEDULE_JOB_EXECUTION_STATUS.FAILED && log.errorMessage ? (
          <div className='mt-2 rounded bg-destructive/10 px-3 py-2'>
            <p className='text-xs font-medium text-destructive'>错误信息</p>
            <p className='mt-0.5 break-all text-xs text-destructive/80'>{log.errorMessage}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
