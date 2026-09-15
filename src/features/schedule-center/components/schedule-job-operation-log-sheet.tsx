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
  ScheduleJobRspDTOStatus,
  type ScheduleJobRspDTO,
  systemScheduleJobOperationLogs,
  type SystemScheduleJobOperationLogsRequest,
  type SystemScheduleJobOperationLogsResponse,
  type ScheduleJobOperationLogRspDTO
} from '@/lib/api/clients/service';

const OPERATION_TYPE_BADGE_VARIANTS: Record<string, React.ComponentProps<typeof Badge>['variant']> =
  {
    CREATE: 'default',
    UPDATE: 'secondary',
    DELETE: 'destructive',
    ENABLE: 'default',
    DISABLE: 'secondary'
  };

const OPERATION_TYPE_LABELS: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '更新',
  DELETE: '删除',
  ENABLE: '启用',
  DISABLE: '禁用'
};

const FIELD_LABELS: Record<string, string> = {
  jobName: '任务名称',
  jobCode: '任务编码',
  defaultCron: '默认 Cron',
  cronExpression: '当前 Cron',
  invokeRoute: '调用路由',
  status: '状态',
  remark: '备注',
  groupName: '任务分组'
};

function getOperationTypeLabel(type?: string): string {
  if (!type) return '-';
  return OPERATION_TYPE_LABELS[type] ?? type;
}

function getOperationTypeBadgeVariant(
  type?: string
): React.ComponentProps<typeof Badge>['variant'] {
  if (!type) return 'outline';
  return OPERATION_TYPE_BADGE_VARIANTS[type] ?? 'outline';
}

function parseOperationContent(content?: string): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (key === 'status') {
    const s = String(value);
    if (s === ScheduleJobRspDTOStatus.enable) return '启用';
    if (s === ScheduleJobRspDTOStatus.disable) return '禁用';
    return s;
  }
  return String(value);
}

function isUpdateContent(
  content: Record<string, unknown>
): content is { before: Record<string, unknown>; after: Record<string, unknown> } {
  return (
    typeof content.before === 'object' &&
    content.before !== null &&
    typeof content.after === 'object' &&
    content.after !== null
  );
}

function FieldRow({ fieldKey, label, value }: { fieldKey: string; label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className='grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-xs'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='min-w-0 break-all'>{formatFieldValue(fieldKey, value)}</span>
    </div>
  );
}

function ContentFields({ data }: { data: Record<string, unknown> }) {
  if (isUpdateContent(data)) {
    return (
      <div className='grid grid-cols-2 gap-4 rounded bg-muted/30 px-3 py-2'>
        <div>
          <p className='mb-1.5 text-xs font-medium text-muted-foreground'>变更前</p>
          <div className='space-y-1'>
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <FieldRow
                key={`before-${key}`}
                fieldKey={key}
                label={label}
                value={data.before[key]}
              />
            ))}
          </div>
        </div>
        <div>
          <p className='mb-1.5 text-xs font-medium text-muted-foreground'>变更后</p>
          <div className='space-y-1'>
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <FieldRow key={`after-${key}`} fieldKey={key} label={label} value={data.after[key]} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-1 rounded bg-muted/30 px-3 py-2'>
      {Object.entries(FIELD_LABELS).map(([key, label]) => (
        <FieldRow key={key} fieldKey={key} label={label} value={data[key]} />
      ))}
    </div>
  );
}

interface ScheduleJobOperationLogSheetProps {
  job: ScheduleJobRspDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleJobOperationLogSheet({
  job,
  open,
  onOpenChange
}: ScheduleJobOperationLogSheetProps) {
  const [logs, setLogs] = React.useState<ScheduleJobOperationLogRspDTO[]>([]);
  const [hasFetched, setHasFetched] = React.useState(false);

  const { mutate: fetchLogs, isPending } = useMutation<
    SystemScheduleJobOperationLogsResponse,
    ApiClientError,
    SystemScheduleJobOperationLogsRequest
  >({
    mutationFn: (request) => systemScheduleJobOperationLogs(request)
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
          <SheetTitle>操作记录</SheetTitle>
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
              <Icons.clipboardList className='mb-2 size-10 text-muted-foreground/50' />
              <p className='text-sm text-muted-foreground'>暂无操作记录</p>
            </div>
          ) : (
            <div className='relative py-2 pl-6'>
              <div className='absolute bottom-0 left-[11px] top-2 w-px bg-border' />
              <div className='space-y-6'>
                {logs.map((log) => (
                  <OperationLogItem key={log.id} log={log} />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function OperationLogItem({ log }: { log: ScheduleJobOperationLogRspDTO }) {
  const [expanded, setExpanded] = React.useState(false);
  const content = parseOperationContent(log.operationContent);

  return (
    <div className='relative'>
      <div className='absolute -left-[25px] top-1.5 size-[9px] rounded-full border-2 border-border bg-background' />
      <div className='rounded-lg border px-3 py-2.5'>
        <div className='flex items-center gap-2'>
          <Badge
            variant={getOperationTypeBadgeVariant(log.operationType)}
            className='h-5 shrink-0 px-1.5 text-[10px]'
          >
            {getOperationTypeLabel(log.operationType)}
          </Badge>
          <span className='text-xs text-muted-foreground'>{nullableDateTime(log.createTime)}</span>
          <span className='ml-auto text-xs text-muted-foreground'>
            {nullableText(log.operatorName) || nullableText(log.operatorId)}
          </span>
        </div>
        {content ? (
          <div className='mt-2'>
            <button
              className='cursor-pointer text-xs text-muted-foreground underline hover:text-foreground'
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '收起详情' : '查看详情'}
            </button>
            {expanded ? (
              <div className='mt-2'>
                <ContentFields data={content} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
